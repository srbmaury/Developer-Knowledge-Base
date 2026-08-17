import {
  addTagToQuestionAction,
  bulkSaveAction,
  createCategoryAction,
  createQuestionAction,
  createSolutionAction,
  createTagAction,
  deleteCategoryAction,
  deleteQuestionAction,
  deleteSolutionAction,
  deleteTagAction,
  getSolutionContentAction,
  moveQuestionAction,
  reorderCategoriesAction,
  reorderQuestionsAction,
  removeTagFromQuestionAction,
  enrollInReviewAction,
  unenrollFromReviewAction,
  submitSpacedReviewAction,
  updateCategoryAction,
  updateCategoryVisibilityAction,
  updateQuestionAction,
  updateQuestionStatusAction,
  updateSolutionAction
} from "@/app/actions";
import type { Difficulty, QuestionStatus, SolutionLanguage, TagColor } from "@/types/knowledge";
import type { ReviewResult } from "@/lib/ai-answer";

type BulkSaveQuestionPatch = { questionId: string; title?: string; description?: string; difficulty?: Difficulty };
type BulkSaveSolutionPatch = { solutionId: string; title?: string; language?: SolutionLanguage; content?: string; notes?: string; aiReview?: ReviewResult | null };
import type { SRGrade } from "@/lib/spaced-repetition";

type QuestionPatch = {
  title?: string;
  description?: string;
  difficulty?: Difficulty;
  isFavorite?: boolean;
  isPinned?: boolean;
};

export const workspaceSync = {
  createCategory: (name: string, parentId?: string | null, order?: number) =>
    createCategoryAction({ name, parentId, order }),

  updateCategory: (categoryId: string, name: string) => updateCategoryAction({ categoryId, name }),

  updateCategoryVisibility: (categoryId: string, isPublic: boolean) =>
    updateCategoryVisibilityAction({ categoryId, isPublic }),

  deleteCategory: (categoryId: string) => deleteCategoryAction({ categoryId }),

  createQuestion: (categoryId: string, title: string, order: number | undefined, defaultLanguage: SolutionLanguage) =>
    createQuestionAction({ categoryId, title, order, defaultLanguage }),

  updateQuestion: (questionId: string, patch: QuestionPatch) => updateQuestionAction({ questionId, ...patch }),

  bulkSave: (questions?: BulkSaveQuestionPatch[], solutions?: BulkSaveSolutionPatch[]) =>
    bulkSaveAction({ questions, solutions }),

  deleteQuestion: (questionId: string) => deleteQuestionAction({ questionId }),

  reorderCategories: (parentId: string | null, categoryIds: string[]) =>
    reorderCategoriesAction({ parentId, categoryIds }),

  reorderQuestions: (categoryId: string, questionIds: string[]) =>
    reorderQuestionsAction({ categoryId, questionIds }),

  createSolution: (questionId: string, title: string, language: SolutionLanguage) =>
    createSolutionAction({ questionId, title, language }),

  deleteSolution: (solutionId: string) => deleteSolutionAction({ solutionId }),

  updateSolution: (
    solutionId: string,
    patch: { title?: string; language?: SolutionLanguage; content?: string; notes?: string; aiReview?: ReviewResult | null }
  ) => updateSolutionAction({ solutionId, ...patch }),

  createTag: (name: string, color: TagColor) => createTagAction({ name, color }),
  deleteTag: (tagId: string) => deleteTagAction({ tagId }),
  addTagToQuestion: (questionId: string, tagId: string) => addTagToQuestionAction({ questionId, tagId }),
  removeTagFromQuestion: (questionId: string, tagId: string) => removeTagFromQuestionAction({ questionId, tagId }),

  updateQuestionStatus: (questionId: string, status: QuestionStatus) =>
    updateQuestionStatusAction({ questionId, status }),
  submitSpacedReview: (questionId: string, grade: SRGrade) =>
    submitSpacedReviewAction({ questionId, grade }),
  moveQuestion: (questionId: string, targetCategoryId: string) =>
    moveQuestionAction({ questionId, targetCategoryId }),
  enrollInReview: (questionId: string) =>
    enrollInReviewAction({ questionId }),
  unenrollFromReview: (questionId: string) =>
    unenrollFromReviewAction({ questionId }),

  getSolutionContent: (solutionId: string) => getSolutionContentAction(solutionId)
};
