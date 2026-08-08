import type { StateCreator } from "zustand";
import { toast } from "sonner";
import { workspaceSync } from "@/lib/workspace-sync";
import { questionToDoc } from "@/lib/search-index";
import type { SRGrade } from "@/lib/spaced-repetition";
import type { Difficulty, Question, QuestionStatus } from "@/types/knowledge";
import {
  buildQuestionIndex,
  canEditCategory,
  canEditQuestion,
  findCategory,
  findCategoryForQuestion,
  mapCategories,
  removeQuestion,
  reorderQuestionsInCategory,
  setPendingValue,
  sortQuestions,
  temporaryId,
  updateQuestionInTree
} from "../workspace-helpers";
import {
  resolveTempQuestionEdit,
  resolveTempSolutionEdit,
  scheduleQuestionDescriptionSave,
  scheduleQuestionDifficultySave,
  scheduleQuestionTitleSave
} from "../workspace-save-scheduler";
import type { WorkspaceState } from "../workspace-store";

export type QuestionSlice = {
  addQuestion: (categoryId: string, title: string) => Promise<void>;
  updateQuestionTitle: (questionId: string, title: string) => void;
  updateQuestionDescription: (questionId: string, description: string) => void;
  updateQuestionDifficulty: (questionId: string, difficulty: Difficulty) => void;
  reorderQuestions: (categoryId: string, questionIds: string[]) => void;
  deleteQuestion: (questionId: string) => void;
  toggleFavorite: (questionId: string) => void;
  toggleImportant: (questionId: string) => void;
  updateQuestionStatus: (questionId: string, status: QuestionStatus) => void;
  submitSpacedReview: (questionId: string, grade: SRGrade) => void;
  moveQuestion: (questionId: string, targetCategoryId: string) => void;
  enrollInReview: (questionId: string) => void;
  unenrollFromReview: (questionId: string) => void;
};

export const createQuestionSlice: StateCreator<WorkspaceState, [], [], QuestionSlice> = (set, get) => ({
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
      status: "NOT_STARTED",
      srDue: null,
      srInterval: 1,
      srEase: 2.5,
      srReviews: 0,
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
          aiReview: null,
          contentLoaded: true,
          order: 0,
          createdAt: now,
          updatedAt: now
        }
      ],
      tags: []
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

      set((state) => {
        const categories = updateQuestionInTree(state.categories, tempQuestionId, (question) => ({
          ...question,
          id: result.question.id,
          solutions: question.solutions.map((solution) =>
            solution.id === tempSolutionId
              ? { ...solution, id: result.question.solutionId ?? solution.id, questionId: result.question.id }
              : solution
          )
        }));
        return {
          categories,
          questionById: buildQuestionIndex(categories),
          selectedQuestionId:
            state.selectedQuestionId === tempQuestionId ? result.question.id : state.selectedQuestionId,
          selectedSolutionId:
            state.selectedSolutionId === tempSolutionId
              ? result.question.solutionId ?? tempSolutionId
              : state.selectedSolutionId
        };
      });

      toast.success("Question created");

      // Replay any title/description/difficulty typed while the id was still temporary — this must
      // not depend on reading current store state, since a concurrent revalidation-triggered
      // setInitialData can replace it before this runs.
      resolveTempQuestionEdit(tempQuestionId, result.question.id);
      if (result.question.solutionId) {
        resolveTempSolutionEdit(tempSolutionId, result.question.solutionId);
      }
    } finally {
      set((state) => ({
        creatingQuestionCategoryIds: setPendingValue(state.creatingQuestionCategoryIds, categoryId, false)
      }));
    }
  },
  updateQuestionTitle: (questionId, title) => {
    if (!canEditQuestion(get().categories, questionId)) return;
    const now = new Date().toISOString();
    set((state) => {
      const categories = updateQuestionInTree(state.categories, questionId, (question) => ({
        ...question, title, updatedAt: now
      }));
      const existing = state.questionById.get(questionId);
      if (existing && state.searchIndex) {
        const updated = { ...existing, title, updatedAt: now };
        try { state.searchIndex.discard(questionId); } catch { /* not indexed yet */ }
        state.searchIndex.add(questionToDoc(updated));
      }
      const questionById = new Map(state.questionById);
      if (existing) questionById.set(questionId, { ...existing, title, updatedAt: now });
      return { categories, questionById };
    });
    scheduleQuestionTitleSave(questionId, title);
  },
  updateQuestionDescription: (questionId, description) => {
    if (!canEditQuestion(get().categories, questionId)) return;
    const now = new Date().toISOString();
    set((state) => {
      const categories = updateQuestionInTree(state.categories, questionId, (question) => ({
        ...question, description, updatedAt: now
      }));
      const existing = state.questionById.get(questionId);
      if (existing && state.searchIndex) {
        const updated = { ...existing, description, updatedAt: now };
        try { state.searchIndex.discard(questionId); } catch { /* not indexed yet */ }
        state.searchIndex.add(questionToDoc(updated));
      }
      const questionById = new Map(state.questionById);
      if (existing) questionById.set(questionId, { ...existing, description, updatedAt: now });
      return { categories, questionById };
    });
    scheduleQuestionDescriptionSave(questionId, description);
  },
  updateQuestionDifficulty: (questionId, difficulty) => {
    if (!canEditQuestion(get().categories, questionId)) return;
    const now = new Date().toISOString();
    set((state) => {
      const categories = updateQuestionInTree(state.categories, questionId, (question) => ({
        ...question, difficulty, updatedAt: now
      }));
      const existing = state.questionById.get(questionId);
      const questionById = new Map(state.questionById);
      if (existing) questionById.set(questionId, { ...existing, difficulty, updatedAt: now });
      return { categories, questionById };
    });
    scheduleQuestionDifficultySave(questionId, difficulty);
  },
  reorderQuestions: (categoryId, questionIds) => {
    if (!canEditCategory(get().categories, categoryId)) return;
    set((state) => ({
      categories: reorderQuestionsInCategory(state.categories, categoryId, questionIds)
    }));
    void workspaceSync.reorderQuestions(categoryId, questionIds);
  },
  deleteQuestion: (questionId) => {
    if (!canEditQuestion(get().categories, questionId)) return;
    void workspaceSync.deleteQuestion(questionId);

    set((state) => {
      const categories = removeQuestion(state.categories, questionId);
      const questionById = new Map(state.questionById);
      questionById.delete(questionId);

      // Not the selected question — no selection change needed.
      if (state.selectedQuestionId !== questionId) {
        return { categories, questionById };
      }

      // Stay in the current category; pick the next question within it (or null).
      const currentCat = state.selectedCategoryId
        ? findCategory(categories, state.selectedCategoryId)
        : null;
      const nextQuestion = currentCat?.questions[0] ?? null;

      return {
        categories,
        questionById,
        selectedCategoryId: state.selectedCategoryId,
        selectedQuestionId: nextQuestion?.id ?? null,
        selectedSolutionId: nextQuestion?.solutions[0]?.id ?? null
      };
    });
  },
  toggleFavorite: (questionId) => {
    if (!canEditQuestion(get().categories, questionId)) return;
    const question = get().questionById.get(questionId);
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
    const question = get().questionById.get(questionId);
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
  },
  updateQuestionStatus: (questionId, status) => {
    if (!canEditQuestion(get().categories, questionId)) return;
    set((state) => ({
      categories: updateQuestionInTree(state.categories, questionId, (q) => ({ ...q, status }))
    }));
    void workspaceSync.updateQuestionStatus(questionId, status);
  },
  submitSpacedReview: (questionId, grade) => {
    if (!canEditQuestion(get().categories, questionId)) return;
    void workspaceSync.submitSpacedReview(questionId, grade).then((result) => {
      if (!result.ok || !("next" in result)) return;
      const { next } = result;
      set((state) => ({
        categories: updateQuestionInTree(state.categories, questionId, (q) => ({
          ...q,
          srDue: next.due,
          srInterval: next.interval,
          srEase: next.ease,
          srReviews: next.reviews
        }))
      }));
    });
  },
  moveQuestion: (questionId, targetCategoryId) => {
    const { categories } = get();
    const srcCat = findCategoryForQuestion(categories, questionId);
    if (!srcCat || !srcCat.canEdit) return;
    const tgtCat = findCategory(categories, targetCategoryId);
    if (!tgtCat || !tgtCat.canEdit) return;
    if (srcCat.id === targetCategoryId) return;
    const question = srcCat.questions.find((q) => q.id === questionId);
    if (!question) return;
    const moved = { ...question, categoryId: targetCategoryId, isPinned: false, order: tgtCat.questions.length };
    set((state) => {
      const categories = mapCategories(state.categories, (cat) => {
        if (cat.id === srcCat.id) return { ...cat, questions: cat.questions.filter((q) => q.id !== questionId) };
        if (cat.id === targetCategoryId) return { ...cat, questions: [...cat.questions, moved] };
        return cat;
      });
      return { categories, questionById: buildQuestionIndex(categories), selectedCategoryId: targetCategoryId };
    });
    void workspaceSync.moveQuestion(questionId, targetCategoryId);
  },
  enrollInReview: (questionId) => {
    if (!canEditQuestion(get().categories, questionId)) return;
    const optimisticDue = new Date().toISOString();
    set((state) => ({
      categories: updateQuestionInTree(state.categories, questionId, (q) => ({
        ...q,
        srDue: optimisticDue
      }))
    }));
    void workspaceSync.enrollInReview(questionId);
  },
  unenrollFromReview: (questionId) => {
    if (!canEditQuestion(get().categories, questionId)) return;
    set((state) => ({
      categories: updateQuestionInTree(state.categories, questionId, (q) => ({
        ...q,
        srDue: null,
        srInterval: 1,
        srEase: 2.5,
        srReviews: 0
      }))
    }));
    void workspaceSync.unenrollFromReview(questionId);
  }
});
