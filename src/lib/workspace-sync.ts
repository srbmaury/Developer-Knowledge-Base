import {
  createCategoryAction,
  createQuestionAction,
  createSolutionAction,
  deleteCategoryAction,
  deleteQuestionAction,
  deleteSolutionAction,
  reorderCategoriesAction,
  reorderQuestionsAction,
  updateCategoryAction,
  updateCategoryVisibilityAction,
  updateQuestionAction,
  updateSolutionAction
} from "@/app/actions";
import type { Difficulty, SolutionLanguage } from "@/types/knowledge";

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
    patch: { title?: string; language?: SolutionLanguage; content?: string; notes?: string }
  ) => updateSolutionAction({ solutionId, ...patch }),

  updateDifficulty: (questionId: string, difficulty: Difficulty) =>
    updateQuestionAction({ questionId, difficulty })
};
