import type MiniSearch from "minisearch";
import { questionToDoc } from "@/lib/search-index";
import type { Category, Question, Solution } from "@/types/knowledge";

export type SolutionLocation = {
  questionId: string;
  categoryId: string;
};

export function flattenQuestions(categories: Category[]): Question[] {
  return categories.flatMap((category) => [
    ...category.questions,
    ...flattenQuestions(category.children)
  ]);
}

export function mapCategories(categories: Category[], mapper: (category: Category) => Category): Category[] {
  return categories.map((category) => mapper({ ...category, children: mapCategories(category.children, mapper) }));
}

export function removeQuestion(categories: Category[], questionId: string): Category[] {
  return categories.map((category) => ({
    ...category,
    questions: category.questions.filter((question) => question.id !== questionId),
    children: removeQuestion(category.children, questionId)
  }));
}

export function sortQuestions(questions: Question[]) {
  return [...questions].sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || a.order - b.order);
}

export function findCategory(categories: Category[], categoryId: string): Category | null {
  for (const category of categories) {
    if (category.id === categoryId) return category;
    const nested = findCategory(category.children, categoryId);
    if (nested) return nested;
  }
  return null;
}

export function findCategoryForQuestion(categories: Category[], questionId: string): Category | null {
  for (const category of categories) {
    if (category.questions.some((question) => question.id === questionId)) return category;
    const nested = findCategoryForQuestion(category.children, questionId);
    if (nested) return nested;
  }
  return null;
}

export function findCategoryForSolution(categories: Category[], solutionId: string): Category | null {
  for (const category of categories) {
    if (category.questions.some((question) => question.solutions.some((solution) => solution.id === solutionId))) {
      return category;
    }
    const nested = findCategoryForSolution(category.children, solutionId);
    if (nested) return nested;
  }
  return null;
}

export function buildQuestionIndex(categories: Category[]): Map<string, Question> {
  const map = new Map<string, Question>();
  const visit = (cats: Category[]) => {
    for (const cat of cats) {
      for (const q of cat.questions) map.set(q.id, q);
      if (cat.children.length) visit(cat.children);
    }
  };
  visit(categories);
  return map;
}

export function buildSolutionLocationIndex(categories: Category[]) {
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

export function buildQuestionLocationIndex(categories: Category[]) {
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

export function canEditCategory(categories: Category[], categoryId: string | null | undefined) {
  return Boolean(categoryId && findCategory(categories, categoryId)?.canEdit);
}

export function canEditQuestion(categories: Category[], questionId: string | null | undefined) {
  return Boolean(questionId && findCategoryForQuestion(categories, questionId)?.canEdit);
}

export function canEditSolution(categories: Category[], solutionId: string | null | undefined) {
  return Boolean(solutionId && findCategoryForSolution(categories, solutionId)?.canEdit);
}

export function collectCategoryIds(category: Category): string[] {
  return [category.id, ...category.children.flatMap(collectCategoryIds)];
}

export function removeCategoryFromTree(categories: Category[], categoryId: string): Category[] {
  return categories
    .filter((category) => category.id !== categoryId)
    .map((category) => ({
      ...category,
      children: removeCategoryFromTree(category.children, categoryId)
    }));
}

export function firstCategoryId(categories: Category[]): string | null {
  if (categories.length === 0) return null;
  return categories[0].id;
}

export function updateQuestionInTree(
  categories: Category[],
  questionId: string,
  updater: (question: Question) => Question
): Category[] {
  return mapCategories(categories, (category) => ({
    ...category,
    questions: category.questions.map((question) => (question.id === questionId ? updater(question) : question))
  }));
}

export function updateSolutionInTree(
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

export function removeSolutionFromTree(categories: Category[], solutionId: string): Category[] {
  return mapCategories(categories, (category) => ({
    ...category,
    questions: category.questions.map((question) => ({
      ...question,
      solutions: question.solutions.filter((solution) => solution.id !== solutionId)
    }))
  }));
}

export function reorderQuestionsInCategory(categories: Category[], categoryId: string, questionIds: string[]): Category[] {
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

export function reorderCategoryList(categories: Category[], categoryIds: string[]): Category[] {
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

export function reorderCategoriesInTree(
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

export function incrementalIndexUpdate(index: MiniSearch | null, question: Question) {
  if (!index) return;
  try { index.discard(question.id); } catch { /* not indexed yet */ }
  index.add(questionToDoc(question));
}

export function temporaryId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function setPendingValue(values: string[], value: string, pending: boolean) {
  return pending
    ? values.includes(value) ? values : [...values, value]
    : values.filter((item) => item !== value);
}
