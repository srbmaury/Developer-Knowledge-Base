import {
  addTagToQuestionAction,
  createCategoryAction,
  createQuestionAction,
  createSolutionAction,
  createTagAction,
  deleteCategoryAction,
  deleteQuestionAction,
  deleteSolutionAction,
  deleteTagAction,
  reorderCategoriesAction,
  reorderQuestionsAction,
  removeTagFromQuestionAction,
  submitSpacedReviewAction,
  updateCategoryAction,
  updateCategoryVisibilityAction,
  updateQuestionAction,
  updateQuestionStatusAction,
  updateSolutionAction
} from "@/app/actions";
import type { Difficulty, QuestionStatus, SolutionLanguage, TagColor } from "@/types/knowledge";
import type { ReviewResult } from "@/lib/ai-answer";
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

  deleteQuestion: (questionId: string) => deleteQuestionAction({ questionId }),

  reorderCategories: (parentId: string | null, categoryIds: string[]) =>
    reorderCategoriesAction({ parentId, categoryIds }),

  reorderQuestions: (categoryId: string, questionIds: string[]) =>
    reorderQuestionsAction({ categoryId, questionIds }),

  createSolution: (questionId: string, title: string) => createSolutionAction({ questionId, title }),

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
    submitSpacedReviewAction({ questionId, grade })
};
