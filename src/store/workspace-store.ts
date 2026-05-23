"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { toast } from "sonner";
import { workspaceSync } from "@/lib/workspace-sync";
import type { Category, Difficulty, Question, Solution, SolutionLanguage } from "@/types/knowledge";

type WorkspaceState = {
  categories: Category[];
  selectedCategoryId: string | null;
  selectedQuestionId: string | null;
  selectedSolutionId: string | null;
  expandedCategoryIds: string[];
  query: string;
  commandOpen: boolean;
  setInitialData: (categories: Category[]) => void;
  selectCategory: (categoryId: string) => void;
  selectQuestion: (questionId: string) => void;
  selectSolution: (solutionId: string) => void;
  toggleCategory: (categoryId: string) => void;
  setQuery: (query: string) => void;
  setCommandOpen: (open: boolean) => void;
  addCategory: (name: string, parentId?: string | null) => Promise<void>;
  updateCategoryName: (categoryId: string, name: string) => void;
  deleteCategory: (categoryId: string) => void;
  addQuestion: (categoryId: string, title: string) => Promise<void>;
  updateQuestionTitle: (questionId: string, title: string) => void;
  updateQuestionDescription: (questionId: string, description: string) => void;
  updateQuestionDifficulty: (questionId: string, difficulty: Difficulty) => void;
  reorderQuestions: (categoryId: string, questionIds: string[]) => void;
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
  updater: (solution: Solution) => Solution
): Category[] {
  const now = new Date().toISOString();

  return mapCategories(categories, (category) => ({
    ...category,
    questions: category.questions.map((question) => {
      if (!question.solutions.some((solution) => solution.id === solutionId)) {
        return question;
      }

      return {
        ...question,
        updatedAt: now,
        solutions: question.solutions.map((solution) =>
          solution.id === solutionId ? updater({ ...solution, updatedAt: now }) : solution
        )
      };
    })
  }));
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

const contentSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleSolutionSave(solutionId: string, content: string) {
  const existing = contentSaveTimers.get(solutionId);
  if (existing) clearTimeout(existing);

  contentSaveTimers.set(
    solutionId,
    setTimeout(() => {
      void workspaceSync.updateSolution(solutionId, { content });
      contentSaveTimers.delete(solutionId);
    }, 600)
  );
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      categories: [],
      selectedCategoryId: null,
      selectedQuestionId: null,
      selectedSolutionId: null,
      expandedCategoryIds: [],
      query: "",
      commandOpen: false,
      setInitialData: (categories) => {
        const state = get();
        const firstCategory = categories[0];
        const firstQuestion = flattenQuestions(categories)[0];
        const selectedCategoryStillExists =
          state.selectedCategoryId !== null && findCategory(categories, state.selectedCategoryId);
        const selectedQuestionStillExists =
          state.selectedQuestionId !== null &&
          flattenQuestions(categories).some((question) => question.id === state.selectedQuestionId);

        set({
          categories,
          selectedCategoryId: selectedCategoryStillExists
            ? state.selectedCategoryId
            : (firstCategory?.id ?? null),
          selectedQuestionId: selectedQuestionStillExists
            ? state.selectedQuestionId
            : (firstQuestion?.id ?? null),
          selectedSolutionId: selectedQuestionStillExists
            ? state.selectedSolutionId
            : (firstQuestion?.solutions[0]?.id ?? null),
          expandedCategoryIds:
            state.expandedCategoryIds.length > 0 ? state.expandedCategoryIds : categories.map((category) => category.id)
        });
      },
      selectCategory: (categoryId) => set({ selectedCategoryId: categoryId }),
      selectQuestion: (questionId) => {
        const question = flattenQuestions(get().categories).find((item) => item.id === questionId);
        set({
          selectedQuestionId: questionId,
          selectedCategoryId: question?.categoryId ?? get().selectedCategoryId,
          selectedSolutionId: question?.solutions[0]?.id ?? null
        });
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
        const siblingCount = parentId
          ? (findCategory(categories, parentId)?.children.length ?? 0)
          : categories.length;

        const result = await workspaceSync.createCategory(name, parentId, siblingCount);
        if (!result.ok || !("id" in result)) {
          toast.error("message" in result ? result.message : "Failed to create category.");
          return;
        }

        const category: Category = {
          id: result.id,
          name,
          parentId,
          order: siblingCount,
          createdAt: new Date().toISOString(),
          children: [],
          questions: []
        };

        set((state) => ({
          categories: parentId
            ? mapCategories(state.categories, (item) =>
                item.id === parentId ? { ...item, children: [...item.children, category] } : item
              )
            : [...state.categories, category],
          selectedCategoryId: category.id,
          expandedCategoryIds: [...state.expandedCategoryIds, category.id, ...(parentId ? [parentId] : [])].filter(
            (id, index, ids) => ids.indexOf(id) === index
          )
        }));
      },
      updateCategoryName: (categoryId, name) => {
        set((state) => ({
          categories: mapCategories(state.categories, (category) =>
            category.id === categoryId ? { ...category, name } : category
          )
        }));
        void workspaceSync.updateCategory(categoryId, name);
      },
      deleteCategory: (categoryId) => {
        const target = findCategory(get().categories, categoryId);
        if (!target) return;

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
        const order = findCategory(categories, categoryId)?.questions.length ?? 0;

        const result = await workspaceSync.createQuestion(categoryId, title, order);
        if (!result.ok || !("question" in result) || !result.question) {
          toast.error("message" in result ? result.message : "Failed to create question.");
          return;
        }

        const question: Question = {
          id: result.question.id,
          categoryId,
          title,
          description: "",
          difficulty: "MEDIUM",
          isFavorite: false,
          isPinned: false,
          order,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          solutions: [
            {
              id: result.question.solutionId ?? "",
              questionId: result.question.id,
              title: "Best Approach",
              language: "none",
              content: "",
              notes: "",
              order: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ]
        };

        set((state) => ({
          categories: mapCategories(state.categories, (cat) =>
            cat.id === categoryId ? { ...cat, questions: sortQuestions([question, ...cat.questions]) } : cat
          ),
          selectedCategoryId: categoryId,
          selectedQuestionId: question.id,
          selectedSolutionId: question.solutions[0].id
        }));
      },
      updateQuestionTitle: (questionId, title) => {
        set((state) => ({
          categories: updateQuestionInTree(state.categories, questionId, (question) => ({
            ...question,
            title,
            updatedAt: new Date().toISOString()
          }))
        }));
        void workspaceSync.updateQuestion(questionId, { title });
      },
      updateQuestionDescription: (questionId, description) => {
        set((state) => ({
          categories: updateQuestionInTree(state.categories, questionId, (question) => ({
            ...question,
            description,
            updatedAt: new Date().toISOString()
          }))
        }));
        void workspaceSync.updateQuestion(questionId, { description });
      },
      updateQuestionDifficulty: (questionId, difficulty) => {
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
        set((state) => ({
          categories: reorderQuestionsInCategory(state.categories, categoryId, questionIds)
        }));
        void workspaceSync.reorderQuestions(categoryId, questionIds);
      },
      deleteQuestion: (questionId) => {
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
        const question = flattenQuestions(get().categories).find((item) => item.id === questionId);
        const order = question?.solutions.length ?? 0;

        const result = await workspaceSync.createSolution(questionId, title);
        if (!result.ok || !("id" in result)) {
          toast.error("Failed to create solution.");
          return;
        }

        const solution: Solution = {
          id: result.id,
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
          categories: updateQuestionInTree(state.categories, questionId, (q) => ({
            ...q,
            solutions: [...q.solutions, solution]
          })),
          selectedSolutionId: solution.id
        }));
      },
      deleteSolution: async (solutionId) => {
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
        set((state) => ({
          categories: updateSolutionInTree(state.categories, solutionId, (solution) => ({ ...solution, title }))
        }));
        void workspaceSync.updateSolution(solutionId, { title });
      },
      updateSolutionLanguage: (solutionId, language) => {
        set((state) => ({
          categories: updateSolutionInTree(state.categories, solutionId, (solution) => ({ ...solution, language }))
        }));
        void workspaceSync.updateSolution(solutionId, { language });
      },
      updateSolutionContent: (solutionId, content) => {
        set((state) => ({
          categories: updateSolutionInTree(state.categories, solutionId, (solution) => ({ ...solution, content }))
        }));
        scheduleSolutionSave(solutionId, content);
      },
      toggleFavorite: (questionId) => {
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
