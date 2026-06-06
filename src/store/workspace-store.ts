"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { toast } from "sonner";
import { workspaceSync } from "@/lib/workspace-sync";
import { SAVE_DEBOUNCE_MS } from "@/lib/constants";
import type { Category, Difficulty, Question, Solution, SolutionLanguage } from "@/types/knowledge";

export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

type WorkspaceState = {
  defaultLanguage: SolutionLanguage;
  categories: Category[];
  selectedCategoryId: string | null;
  selectedQuestionId: string | null;
  selectedSolutionId: string | null;
  expandedCategoryIds: string[];
  creatingCategoryKeys: string[];
  creatingQuestionCategoryIds: string[];
  creatingSolutionQuestionIds: string[];
  saveStatus: SaveStatus;
  query: string;
  commandOpen: boolean;

  /** Derived indexes for faster lookups (not persisted) */
  questionIdToCategoryId: Map<string, string>;
  solutionIdToLocation: Map<string, SolutionLocation>;

  setInitialData: (categories: Category[]) => void;
  selectCategory: (categoryId: string) => void;
  selectQuestion: (questionId: string) => void;
  selectSolution: (solutionId: string) => void;
  toggleCategory: (categoryId: string) => void;
  setQuery: (query: string) => void;
  setCommandOpen: (open: boolean) => void;
  addCategory: (name: string, parentId?: string | null) => Promise<void>;
  updateCategoryName: (categoryId: string, name: string) => void;
  updateCategoryVisibility: (categoryId: string, isPublic: boolean) => void;
  deleteCategory: (categoryId: string) => void;
  addQuestion: (categoryId: string, title: string) => Promise<void>;
  updateQuestionTitle: (questionId: string, title: string) => void;
  updateQuestionDescription: (questionId: string, description: string) => void;
  updateQuestionDifficulty: (questionId: string, difficulty: Difficulty) => void;
  reorderQuestions: (categoryId: string, questionIds: string[]) => void;
  reorderCategories: (parentId: string | null, categoryIds: string[]) => void;
  deleteQuestion: (questionId: string) => void;
  addSolution: (questionId: string, title: string) => Promise<void>;
  deleteSolution: (solutionId: string) => Promise<void>;
  updateSolutionTitle: (solutionId: string, title: string) => void;
  updateSolutionLanguage: (solutionId: string, language: SolutionLanguage) => void;
  updateSolutionContent: (solutionId: string, content: string) => void;
  toggleFavorite: (questionId: string) => void;
  toggleImportant: (questionId: string) => void;
};

function flattenQuestions(categories: Category[]): Question[] {
  return categories.flatMap((category) => [
    ...category.questions,
    ...flattenQuestions(category.children)
  ]);
}

function mapCategories(categories: Category[], mapper: (category: Category) => Category): Category[] {
  return categories.map((category) => mapper({ ...category, children: mapCategories(category.children, mapper) }));
}

function removeQuestion(categories: Category[], questionId: string): Category[] {
  return categories.map((category) => ({
    ...category,
    questions: category.questions.filter((question) => question.id !== questionId),
    children: removeQuestion(category.children, questionId)
  }));
}

function sortQuestions(questions: Question[]) {
  return [...questions].sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || a.order - b.order);
}

function findCategory(categories: Category[], categoryId: string): Category | null {
  for (const category of categories) {
    if (category.id === categoryId) return category;
    const nested = findCategory(category.children, categoryId);
    if (nested) return nested;
  }
  return null;
}

function findCategoryForQuestion(categories: Category[], questionId: string): Category | null {
  for (const category of categories) {
    if (category.questions.some((question) => question.id === questionId)) return category;
    const nested = findCategoryForQuestion(category.children, questionId);
    if (nested) return nested;
  }
  return null;
}

type SolutionLocation = {
  questionId: string;
  categoryId: string;
};

function findCategoryForSolution(categories: Category[], solutionId: string): Category | null {
  for (const category of categories) {
    if (category.questions.some((question) => question.solutions.some((solution) => solution.id === solutionId))) {
      return category;
    }
    const nested = findCategoryForSolution(category.children, solutionId);
    if (nested) return nested;
  }
  return null;
}

function buildSolutionLocationIndex(categories: Category[]) {
  const bySolutionId = new Map<string, SolutionLocation>();

  const visit = (nodes: Category[]) => {
    for (const category of nodes) {
      for (const question of category.questions) {
        for (const solution of question.solutions) {
          bySolutionId.set(solution.id, { questionId: question.id, categoryId: category.id });
        }
      }
      if (category.children?.length) visit(category.children);
    }
  };

  visit(categories);
  return bySolutionId;
}

function buildQuestionLocationIndex(categories: Category[]) {
  const byQuestionId = new Map<string, string>(); // questionId -> categoryId

  const visit = (nodes: Category[]) => {
    for (const category of nodes) {
      for (const question of category.questions) {
        byQuestionId.set(question.id, category.id);
      }
      if (category.children?.length) visit(category.children);
    }
  };

  visit(categories);
  return byQuestionId;
}

function canEditCategory(categories: Category[], categoryId: string | null | undefined) {
  return Boolean(categoryId && findCategory(categories, categoryId)?.canEdit);
}

function canEditQuestion(categories: Category[], questionId: string | null | undefined) {
  return Boolean(questionId && findCategoryForQuestion(categories, questionId)?.canEdit);
}

function canEditSolution(categories: Category[], solutionId: string | null | undefined) {
  return Boolean(solutionId && findCategoryForSolution(categories, solutionId)?.canEdit);
}

function collectCategoryIds(category: Category): string[] {
  return [category.id, ...category.children.flatMap(collectCategoryIds)];
}

function removeCategoryFromTree(categories: Category[], categoryId: string): Category[] {
  return categories
    .filter((category) => category.id !== categoryId)
    .map((category) => ({
      ...category,
      children: removeCategoryFromTree(category.children, categoryId)
    }));
}

function firstCategoryId(categories: Category[]): string | null {
  if (categories.length === 0) return null;
  return categories[0].id;
}

function updateQuestionInTree(
  categories: Category[],
  questionId: string,
  updater: (question: Question) => Question
): Category[] {
  return mapCategories(categories, (category) => ({
    ...category,
    questions: category.questions.map((question) => (question.id === questionId ? updater(question) : question))
  }));
}

function updateSolutionInTree(
  categories: Category[],
  solutionId: string,
  updater: (solution: Solution) => Solution,
  opts?: { categoryIdToMutate?: string; questionIdToMutate?: string }
): Category[] {
  const now = new Date().toISOString();

  return mapCategories(categories, (category) => {
    const shouldMutateCategory = opts?.categoryIdToMutate ? category.id === opts.categoryIdToMutate : true;
    if (!shouldMutateCategory) return category;

    return {
      ...category,
      questions: category.questions.map((question) => {
        const shouldMutateQuestion = opts?.questionIdToMutate
          ? question.id === opts.questionIdToMutate
          : question.solutions.some((solution) => solution.id === solutionId);

        if (!shouldMutateQuestion) return question;

        return {
          ...question,
          updatedAt: now,
          solutions: question.solutions.map((solution) =>
            solution.id === solutionId ? updater({ ...solution, updatedAt: now }) : solution
          )
        };
      })
    };
  });
}

function removeSolutionFromTree(categories: Category[], solutionId: string): Category[] {
  return mapCategories(categories, (category) => ({
    ...category,
    questions: category.questions.map((question) => ({
      ...question,
      solutions: question.solutions.filter((solution) => solution.id !== solutionId)
    }))
  }));
}

function reorderQuestionsInCategory(categories: Category[], categoryId: string, questionIds: string[]): Category[] {
  return mapCategories(categories, (category) => {
    if (category.id !== categoryId) return category;

    const byId = new Map(category.questions.map((question) => [question.id, question]));
    const reordered = questionIds
      .map((id) => byId.get(id))
      .filter((question): question is Question => question !== undefined);

    const remaining = category.questions.filter((question) => !questionIds.includes(question.id));

    let pinnedOrder = 0;
    let unpinnedOrder = 0;
    const withOrder = [...reordered, ...remaining].map((question) => ({
      ...question,
      order: question.isPinned ? pinnedOrder++ : unpinnedOrder++
    }));

    return { ...category, questions: sortQuestions(withOrder) };
  });
}

function reorderCategoryList(categories: Category[], categoryIds: string[]): Category[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const reordered = categoryIds
    .map((id) => byId.get(id))
    .filter((category): category is Category => category !== undefined);
  const remaining = categories.filter((category) => !categoryIds.includes(category.id));

  return reordered.concat(remaining).map((category, index) => ({
    ...category,
    order: index
  }));
}

function reorderCategoriesInTree(
  categories: Category[],
  parentId: string | null,
  categoryIds: string[]
): Category[] {
  if (parentId === null) {
    return reorderCategoryList(categories, categoryIds);
  }

  return mapCategories(categories, (category) => {
    if (category.id === parentId) {
      return {
        ...category,
        children: reorderCategoryList(category.children, categoryIds)
      };
    }
    return category;
  });
}

const contentSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const categoryNameSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const questionTitleSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const questionDescriptionSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const solutionTitleSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
let activeSaveCount = 0;
let savedStatusTimer: ReturnType<typeof setTimeout> | null = null;
let setSaveStatus: ((status: SaveStatus) => void) | null = null;

function temporaryId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function setPendingValue(values: string[], value: string, pending: boolean) {
  return pending
    ? values.includes(value) ? values : [...values, value]
    : values.filter((item) => item !== value);
}

function markSavePending() {
  if (savedStatusTimer) clearTimeout(savedStatusTimer);
  setSaveStatus?.("pending");
}

function runSave(operation: () => Promise<unknown>) {
  activeSaveCount += 1;
  if (savedStatusTimer) clearTimeout(savedStatusTimer);
  setSaveStatus?.("saving");

  void operation()
    .then(() => {
      activeSaveCount -= 1;
      if (activeSaveCount === 0) {
        setSaveStatus?.("saved");
        savedStatusTimer = setTimeout(() => {
          setSaveStatus?.("idle");
          savedStatusTimer = null;
        }, 1400);
      }
    })
    .catch(() => {
      activeSaveCount = Math.max(0, activeSaveCount - 1);
      setSaveStatus?.("error");
    });
}

function scheduleCategoryNameSave(categoryId: string, name: string) {
  if (categoryId.startsWith("temp-")) return;
  const existing = categoryNameSaveTimers.get(categoryId);
  if (existing) clearTimeout(existing);
  markSavePending();

  categoryNameSaveTimers.set(
    categoryId,
    setTimeout(() => {
      runSave(() => workspaceSync.updateCategory(categoryId, name));
      categoryNameSaveTimers.delete(categoryId);
    }, SAVE_DEBOUNCE_MS)
  );
}

function scheduleQuestionTitleSave(questionId: string, title: string) {
  if (questionId.startsWith("temp-")) return;
  const existing = questionTitleSaveTimers.get(questionId);
  if (existing) clearTimeout(existing);
  markSavePending();

  questionTitleSaveTimers.set(
    questionId,
    setTimeout(() => {
      runSave(() => workspaceSync.updateQuestion(questionId, { title }));
      questionTitleSaveTimers.delete(questionId);
    }, SAVE_DEBOUNCE_MS)
  );
}

function scheduleQuestionDescriptionSave(questionId: string, description: string) {
  if (questionId.startsWith("temp-")) return;
  const existing = questionDescriptionSaveTimers.get(questionId);
  if (existing) clearTimeout(existing);
  markSavePending();

  questionDescriptionSaveTimers.set(
    questionId,
    setTimeout(() => {
      runSave(() => workspaceSync.updateQuestion(questionId, { description }));
      questionDescriptionSaveTimers.delete(questionId);
    }, SAVE_DEBOUNCE_MS)
  );
}

function scheduleSolutionTitleSave(solutionId: string, title: string) {
  if (solutionId.startsWith("temp-")) return;
  const existing = solutionTitleSaveTimers.get(solutionId);
  if (existing) clearTimeout(existing);
  markSavePending();

  solutionTitleSaveTimers.set(
    solutionId,
    setTimeout(() => {
      runSave(() => workspaceSync.updateSolution(solutionId, { title }));
      solutionTitleSaveTimers.delete(solutionId);
    }, SAVE_DEBOUNCE_MS)
  );
}

function scheduleSolutionSave(solutionId: string, content: string) {
  if (solutionId.startsWith("temp-")) return;
  const existing = contentSaveTimers.get(solutionId);
  if (existing) clearTimeout(existing);
  markSavePending();

  contentSaveTimers.set(
    solutionId,
    setTimeout(() => {
      runSave(() => workspaceSync.updateSolution(solutionId, { content }));
      contentSaveTimers.delete(solutionId);
    }, SAVE_DEBOUNCE_MS)
  );
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      defaultLanguage: "typescript",
      ...(setSaveStatus ??= (status: SaveStatus) => set({ saveStatus: status })),
      categories: [],
      selectedCategoryId: null,
      selectedQuestionId: null,
      selectedSolutionId: null,
      expandedCategoryIds: [],
      creatingCategoryKeys: [],
      creatingQuestionCategoryIds: [],
      creatingSolutionQuestionIds: [],
      saveStatus: "idle",
      query: "",
      commandOpen: false,
      questionIdToCategoryId: new Map(),
      solutionIdToLocation: new Map(),
      setInitialData: (categories) => {
        const questionIdToCategoryId = buildQuestionLocationIndex(categories);
        const solutionIdToLocation = buildSolutionLocationIndex(categories);
        const state = get();
        const firstCategory = categories[0];
        const firstQuestion = flattenQuestions(categories)[0];
        const selectedCategoryStillExists =
          state.selectedCategoryId !== null && findCategory(categories, state.selectedCategoryId);
        const selectedQuestionStillExists =
          state.selectedQuestionId !== null &&
          flattenQuestions(categories).some((question) => question.id === state.selectedQuestionId);

        // Respect persisted expandedCategoryIds even when it's an empty array.
        let persistedExpanded: string[] | undefined = undefined;
        try {
          const raw = localStorage.getItem("developer-knowledge-base-workspace");
          if (raw) {
            const parsed = JSON.parse(raw);
            const maybeState = parsed?.state ?? parsed;
            if (maybeState && Array.isArray(maybeState.expandedCategoryIds)) persistedExpanded = maybeState.expandedCategoryIds;
          }
        } catch (e) {
          // ignore
        }

        set({
          categories,
          questionIdToCategoryId,
          solutionIdToLocation,
          selectedCategoryId: selectedCategoryStillExists
            ? state.selectedCategoryId
            : (firstCategory?.id ?? null),
          selectedQuestionId: selectedQuestionStillExists
            ? state.selectedQuestionId
            : (firstQuestion?.id ?? null),
          selectedSolutionId: selectedQuestionStillExists
            ? state.selectedSolutionId
            : (firstQuestion?.solutions[0]?.id ?? null),
          expandedCategoryIds: persistedExpanded !== undefined
            ? persistedExpanded
            : (state.expandedCategoryIds.length > 0 ? state.expandedCategoryIds : categories.map((category) => category.id))
        });
      },
      selectCategory: (categoryId) => set({ selectedCategoryId: categoryId }),
      selectQuestion: (questionId) => {
        const state = get();
        const question = flattenQuestions(state.categories).find((item) => item.id === questionId);
        const categoryId = state.questionIdToCategoryId.get(questionId) ?? question?.categoryId ?? state.selectedCategoryId;
        set({
          selectedQuestionId: questionId,
          selectedCategoryId: categoryId,
          selectedSolutionId: question?.solutions[0]?.id ?? null
        });

        // URL sync is handled by client components (Sidebar) via `?q=<questionId>`.
      },
      selectSolution: (solutionId) => set({ selectedSolutionId: solutionId }),
      toggleCategory: (categoryId) =>
        set((state) => ({
          expandedCategoryIds: state.expandedCategoryIds.includes(categoryId)
            ? state.expandedCategoryIds.filter((id) => id !== categoryId)
            : [...state.expandedCategoryIds, categoryId]
        })),
      setQuery: (query) => set({ query }),
      setCommandOpen: (commandOpen) => set({ commandOpen }),
      addCategory: async (name, parentId = null) => {
        const { categories } = get();
        if (parentId && !canEditCategory(categories, parentId)) return;
        const pendingKey = parentId ?? "__root__";
        if (get().creatingCategoryKeys.includes(pendingKey)) return;
        const tempId = temporaryId("temp-category");
        const siblingCount = parentId
          ? (findCategory(categories, parentId)?.children.length ?? 0)
          : categories.length;
        const optimisticCategory: Category = {
          id: tempId,
          userId: "",
          name,
          isPublic: false,
          canEdit: true,
          parentId,
          order: siblingCount,
          createdAt: new Date().toISOString(),
          children: [],
          questions: []
        };

        set((state) => ({
          creatingCategoryKeys: setPendingValue(state.creatingCategoryKeys, pendingKey, true),
          categories: parentId
            ? mapCategories(state.categories, (item) =>
                item.id === parentId ? { ...item, children: [...item.children, optimisticCategory] } : item
              )
            : [...state.categories, optimisticCategory],
          selectedCategoryId: tempId,
          expandedCategoryIds: [...state.expandedCategoryIds, tempId, ...(parentId ? [parentId] : [])].filter(
            (id, index, ids) => ids.indexOf(id) === index
          )
        }));

        try {
          const result = await workspaceSync.createCategory(name, parentId, siblingCount);
          if (!result.ok || !("id" in result)) {
            toast.error("message" in result ? result.message : "Failed to create category.");
            set((state) => ({
              categories: removeCategoryFromTree(state.categories, tempId),
              selectedCategoryId: state.selectedCategoryId === tempId ? firstCategoryId(removeCategoryFromTree(state.categories, tempId)) : state.selectedCategoryId
            }));
            return;
          }
          const currentCategory = findCategory(get().categories, tempId);

          set((state) => ({
            categories: mapCategories(state.categories, (item) =>
              item.id === tempId ? { ...item, id: result.id } : item
            ),
            selectedCategoryId: state.selectedCategoryId === tempId ? result.id : state.selectedCategoryId,
            expandedCategoryIds: state.expandedCategoryIds.map((id) => (id === tempId ? result.id : id)).filter(
              (id, index, ids) => ids.indexOf(id) === index
            )
          }));
          if (currentCategory && currentCategory.name !== name) {
            runSave(() => workspaceSync.updateCategory(result.id, currentCategory.name));
          }
        } finally {
          set((state) => ({
            creatingCategoryKeys: setPendingValue(state.creatingCategoryKeys, pendingKey, false)
          }));
        }
      },
      updateCategoryName: (categoryId, name) => {
        if (!canEditCategory(get().categories, categoryId)) return;
        set((state) => ({
          categories: mapCategories(state.categories, (category) =>
            category.id === categoryId ? { ...category, name } : category
          )
        }));
        scheduleCategoryNameSave(categoryId, name);
      },
      updateCategoryVisibility: (categoryId, isPublic) => {
        if (!canEditCategory(get().categories, categoryId)) return;
        set((state) => ({
          categories: mapCategories(state.categories, (category) =>
            category.id === categoryId ? { ...category, isPublic } : category
          )
        }));
        void workspaceSync.updateCategoryVisibility(categoryId, isPublic);
      },
      deleteCategory: (categoryId) => {
        const target = findCategory(get().categories, categoryId);
        if (!target || !target.canEdit) return;

        const deletedCategoryIds = new Set(collectCategoryIds(target));
        void workspaceSync.deleteCategory(categoryId);

        set((state) => {
          const categories = removeCategoryFromTree(state.categories, categoryId);
          const remainingQuestions = flattenQuestions(categories);
          const selectedQuestionRemoved =
            state.selectedQuestionId !== null &&
            !remainingQuestions.some((question) => question.id === state.selectedQuestionId);
          const selectedCategoryRemoved =
            state.selectedCategoryId !== null && deletedCategoryIds.has(state.selectedCategoryId);
          const nextQuestion = selectedQuestionRemoved
            ? (remainingQuestions[0]?.id ?? null)
            : state.selectedQuestionId;
          const nextCategory = selectedCategoryRemoved
            ? ((nextQuestion
                ? remainingQuestions.find((question) => question.id === nextQuestion)?.categoryId
                : null) ?? firstCategoryId(categories))
            : state.selectedCategoryId;
          const nextSolution = selectedQuestionRemoved
            ? (remainingQuestions[0]?.solutions[0]?.id ?? null)
            : state.selectedSolutionId;

          return {
            categories,
            selectedCategoryId: nextCategory,
            selectedQuestionId: nextQuestion,
            selectedSolutionId: nextSolution,
            expandedCategoryIds: state.expandedCategoryIds.filter((id) => !deletedCategoryIds.has(id))
          };
        });
      },
      addQuestion: async (categoryId, title) => {
        const { categories } = get();
        if (!canEditCategory(categories, categoryId)) return;
        if (get().creatingQuestionCategoryIds.includes(categoryId)) return;
        const tempQuestionId = temporaryId("temp-question");
        const tempSolutionId = temporaryId("temp-solution");
        const order = findCategory(categories, categoryId)?.questions.length ?? 0;
        const now = new Date().toISOString();
        const optimisticQuestion: Question = {
          id: tempQuestionId,
          categoryId,
          title,
          description: "",
          difficulty: "MEDIUM",
          isFavorite: false,
          isPinned: false,
          order,
          createdAt: now,
          updatedAt: now,
          solutions: [
            {
              id: tempSolutionId,
              questionId: tempQuestionId,
              title: "Best Approach",
              language: "none",
              content: "",
              notes: "",
              order: 0,
              createdAt: now,
              updatedAt: now
            }
          ]
        };

        set((state) => ({
          creatingQuestionCategoryIds: setPendingValue(state.creatingQuestionCategoryIds, categoryId, true),
          categories: mapCategories(state.categories, (cat) =>
            cat.id === categoryId
              ? { ...cat, questions: sortQuestions([optimisticQuestion, ...cat.questions]) }
              : cat
          ),
          selectedCategoryId: categoryId,
          selectedQuestionId: tempQuestionId,
          selectedSolutionId: tempSolutionId
        }));

        try {
          const result = await workspaceSync.createQuestion(categoryId, title, order, get().defaultLanguage);
          if (!result.ok || !("question" in result) || !result.question) {
            toast.error("message" in result ? result.message : "Failed to create question.");
            set((state) => ({
              categories: removeQuestion(state.categories, tempQuestionId),
              selectedQuestionId: state.selectedQuestionId === tempQuestionId ? null : state.selectedQuestionId,
              selectedSolutionId: state.selectedSolutionId === tempSolutionId ? null : state.selectedSolutionId
            }));
            return;
          }

          const currentQuestion = flattenQuestions(get().categories).find((item) => item.id === tempQuestionId);

          set((state) => ({
            categories: updateQuestionInTree(state.categories, tempQuestionId, (question) => ({
              ...question,
              id: result.question.id,
              solutions: question.solutions.map((solution) =>
                solution.id === tempSolutionId
                  ? {
                      ...solution,
                      id: result.question.solutionId ?? solution.id,
                      questionId: result.question.id
                    }
                  : solution
              )
            })),
            selectedQuestionId:
              state.selectedQuestionId === tempQuestionId ? result.question.id : state.selectedQuestionId,
            selectedSolutionId:
              state.selectedSolutionId === tempSolutionId
                ? result.question.solutionId ?? tempSolutionId
                : state.selectedSolutionId
          }));
          
          toast.success("Question created");
          
          if (currentQuestion) {
            if (currentQuestion.title !== title || currentQuestion.description) {
              runSave(() =>
                workspaceSync.updateQuestion(result.question.id, {
                  ...(currentQuestion.title !== title ? { title: currentQuestion.title } : {}),
                  ...(currentQuestion.description ? { description: currentQuestion.description } : {})
                })
              );
            }
            const currentSolution = currentQuestion.solutions.find((item) => item.id === tempSolutionId);
            if (currentSolution && currentSolution.content && result.question.solutionId) {
              runSave(() =>
                workspaceSync.updateSolution(result.question.solutionId!, {
                  content: currentSolution.content,
                  title: currentSolution.title,
                  language: currentSolution.language
                })
              );
            }
          }
        } finally {
          set((state) => ({
            creatingQuestionCategoryIds: setPendingValue(state.creatingQuestionCategoryIds, categoryId, false)
          }));
        }
      },
      updateQuestionTitle: (questionId, title) => {
        if (!canEditQuestion(get().categories, questionId)) return;
        set((state) => ({
          categories: updateQuestionInTree(state.categories, questionId, (question) => ({
            ...question,
            title,
            updatedAt: new Date().toISOString()
          }))
        }));
        scheduleQuestionTitleSave(questionId, title);
      },
      updateQuestionDescription: (questionId, description) => {
        if (!canEditQuestion(get().categories, questionId)) return;
        set((state) => ({
          categories: updateQuestionInTree(state.categories, questionId, (question) => ({
            ...question,
            description,
            updatedAt: new Date().toISOString()
          }))
        }));
        scheduleQuestionDescriptionSave(questionId, description);
      },
      updateQuestionDifficulty: (questionId, difficulty) => {
        if (!canEditQuestion(get().categories, questionId)) return;
        set((state) => ({
          categories: updateQuestionInTree(state.categories, questionId, (question) => ({
            ...question,
            difficulty,
            updatedAt: new Date().toISOString()
          }))
        }));
        void workspaceSync.updateDifficulty(questionId, difficulty);
      },
      reorderQuestions: (categoryId, questionIds) => {
        if (!canEditCategory(get().categories, categoryId)) return;
        set((state) => ({
          categories: reorderQuestionsInCategory(state.categories, categoryId, questionIds)
        }));
        void workspaceSync.reorderQuestions(categoryId, questionIds);
      },
      reorderCategories: (parentId, categoryIds) => {
        set((state) => ({
          categories: reorderCategoriesInTree(state.categories, parentId, categoryIds)
        }));
        void workspaceSync.reorderCategories(parentId, categoryIds);
      },
      deleteQuestion: (questionId) => {
        if (!canEditQuestion(get().categories, questionId)) return;
        void workspaceSync.deleteQuestion(questionId);

        set((state) => {
          const categories = removeQuestion(state.categories, questionId);
          const nextQuestion = flattenQuestions(categories)[0] ?? null;

          return {
            categories,
            selectedQuestionId: state.selectedQuestionId === questionId ? nextQuestion?.id ?? null : state.selectedQuestionId,
            selectedCategoryId:
              state.selectedQuestionId === questionId ? nextQuestion?.categoryId ?? state.selectedCategoryId : state.selectedCategoryId,
            selectedSolutionId:
              state.selectedQuestionId === questionId ? nextQuestion?.solutions[0]?.id ?? null : state.selectedSolutionId
          };
        });
      },
      addSolution: async (questionId, title) => {
        if (!canEditQuestion(get().categories, questionId)) return;
        if (get().creatingSolutionQuestionIds.includes(questionId)) return;
        const tempSolutionId = temporaryId("temp-solution");
        const question = flattenQuestions(get().categories).find((item) => item.id === questionId);
        const order = question?.solutions.length ?? 0;
        const optimisticSolution: Solution = {
          id: tempSolutionId,
          questionId,
          title,
          language: "none",
          content: "",
          notes: "",
          order,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        set((state) => ({
          creatingSolutionQuestionIds: setPendingValue(state.creatingSolutionQuestionIds, questionId, true),
          categories: updateQuestionInTree(state.categories, questionId, (item) => ({
            ...item,
            solutions: [...item.solutions, optimisticSolution]
          })),
          selectedSolutionId: tempSolutionId
        }));

        try {
          const result = await workspaceSync.createSolution(questionId, title);
          if (!result.ok || !("id" in result)) {
            toast.error("Failed to create solution.");
            set((state) => ({
              categories: removeSolutionFromTree(state.categories, tempSolutionId),
              selectedSolutionId: state.selectedSolutionId === tempSolutionId ? question?.solutions[0]?.id ?? null : state.selectedSolutionId
            }));
            return;
          }
          const currentSolution = flattenQuestions(get().categories)
            .flatMap((item) => item.solutions)
            .find((item) => item.id === tempSolutionId);

          set((state) => ({
            categories: updateSolutionInTree(state.categories, tempSolutionId, (solution) => ({
              ...solution,
              id: result.id
            })),
            selectedSolutionId: state.selectedSolutionId === tempSolutionId ? result.id : state.selectedSolutionId
          }));
          if (currentSolution && (currentSolution.title !== title || currentSolution.content || currentSolution.language !== "none")) {
            runSave(() =>
              workspaceSync.updateSolution(result.id, {
                title: currentSolution.title,
                content: currentSolution.content,
                language: currentSolution.language
              })
            );
          }
        } finally {
          set((state) => ({
            creatingSolutionQuestionIds: setPendingValue(state.creatingSolutionQuestionIds, questionId, false)
          }));
        }
      },
      deleteSolution: async (solutionId) => {
        if (!canEditSolution(get().categories, solutionId)) return;
        const question = flattenQuestions(get().categories).find((item) =>
          item.solutions.some((solution) => solution.id === solutionId)
        );
        if (!question) return;

        if (question.solutions.length <= 1) {
          toast.error("A question must have at least one approach.");
          return;
        }

        const result = await workspaceSync.deleteSolution(solutionId);
        if (!result.ok) {
          toast.error("message" in result ? result.message : "Failed to delete approach.");
          return;
        }

        const pendingSave = contentSaveTimers.get(solutionId);
        if (pendingSave) clearTimeout(pendingSave);
        contentSaveTimers.delete(solutionId);

        set((state) => {
          const categories = removeSolutionFromTree(state.categories, solutionId);
          const updatedQuestion = flattenQuestions(categories).find((item) => item.id === question.id);
          const nextSolutionId =
            state.selectedSolutionId === solutionId
              ? (updatedQuestion?.solutions[0]?.id ?? null)
              : state.selectedSolutionId;

          return {
            categories,
            selectedSolutionId: nextSolutionId
          };
        });

        toast.success("Approach deleted");
      },
      updateSolutionTitle: (solutionId, title) => {
        if (!canEditSolution(get().categories, solutionId)) return;
        set((state) => ({
          categories: updateSolutionInTree(state.categories, solutionId, (solution) => ({ ...solution, title }))
        }));
        scheduleSolutionTitleSave(solutionId, title);
      },
      updateSolutionLanguage: (solutionId, language) => {
        if (!canEditSolution(get().categories, solutionId)) return;
        set((state) => ({
          categories: updateSolutionInTree(state.categories, solutionId, (solution) => ({ ...solution, language }))
        }));
        void workspaceSync.updateSolution(solutionId, { language });
      },
      updateSolutionContent: (solutionId, content) => {
        if (!canEditSolution(get().categories, solutionId)) return;
        set((state) => ({
          categories: updateSolutionInTree(state.categories, solutionId, (solution) => ({ ...solution, content }))
        }));
        scheduleSolutionSave(solutionId, content);
      },
      toggleFavorite: (questionId) => {
        if (!canEditQuestion(get().categories, questionId)) return;
        const question = flattenQuestions(get().categories).find((item) => item.id === questionId);
        if (!question) return;

        const isFavorite = !question.isFavorite;
        set((state) => ({
          categories: updateQuestionInTree(state.categories, questionId, (q) => ({
            ...q,
            isFavorite,
            updatedAt: new Date().toISOString()
          }))
        }));
        void workspaceSync.updateQuestion(questionId, { isFavorite });
      },
      toggleImportant: (questionId) => {
        if (!canEditQuestion(get().categories, questionId)) return;
        const question = flattenQuestions(get().categories).find((item) => item.id === questionId);
        if (!question) return;

        const isPinned = !question.isPinned;
        set((state) => ({
          categories: mapCategories(state.categories, (category) => {
            const pinnedCount = category.questions.filter((item) => item.isPinned && item.id !== questionId).length;
            const unpinnedCount = category.questions.filter((item) => !item.isPinned && item.id !== questionId).length;

            return {
              ...category,
              questions: sortQuestions(
                category.questions.map((item) =>
                  item.id === questionId
                    ? {
                        ...item,
                        isPinned,
                        order: isPinned ? pinnedCount : unpinnedCount,
                        updatedAt: new Date().toISOString()
                      }
                    : item
                )
              )
            };
          })
        }));
        void workspaceSync.updateQuestion(questionId, { isPinned });
      }
    }),
    {
      name: "developer-knowledge-base-workspace",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        defaultLanguage: state.defaultLanguage,
        selectedCategoryId: state.selectedCategoryId,
        selectedQuestionId: state.selectedQuestionId,
        selectedSolutionId: state.selectedSolutionId,
        expandedCategoryIds: state.expandedCategoryIds
      })
    }
  )
);

export function getAllQuestions(categories: Category[]) {
  return flattenQuestions(categories);
}

export function sortQuestionsForDisplay(questions: Question[]) {
  return sortQuestions(questions);
}

export function getCategoryForQuestion(categories: Category[], questionId: string | null | undefined) {
  return questionId ? findCategoryForQuestion(categories, questionId) : null;
}

export function getCategoryById(categories: Category[], categoryId: string | null | undefined) {
  return categoryId ? findCategory(categories, categoryId) : null;
}
