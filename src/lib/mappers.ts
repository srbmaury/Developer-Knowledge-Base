import type { Prisma } from "@prisma/client";
import { compareQuestionsByPinAndOrder } from "@/lib/question-order";
import type { Category, Difficulty, Question, Solution, SolutionLanguage } from "@/types/knowledge";

type CategoryWithRelations = Prisma.CategoryGetPayload<{
  include: {
    questions: {
      include: { solutions: true };
    };
  };
}>;

function toSolutionLanguage(value: string): SolutionLanguage {
  const allowed: SolutionLanguage[] = ["none", "java", "cpp", "javascript", "typescript", "python", "sql"];
  return allowed.includes(value as SolutionLanguage) ? (value as SolutionLanguage) : "typescript";
}

function mapSolution(solution: CategoryWithRelations["questions"][number]["solutions"][number]): Solution {
  return {
    id: solution.id,
    questionId: solution.questionId,
    title: solution.title,
    language: toSolutionLanguage(solution.language),
    content: solution.content,
    notes: solution.notes,
    order: solution.order,
    createdAt: solution.createdAt.toISOString(),
    updatedAt: solution.updatedAt.toISOString()
  };
}

function mapQuestion(question: CategoryWithRelations["questions"][number]): Question {
  return {
    id: question.id,
    categoryId: question.categoryId,
    title: question.title,
    description: question.description,
    difficulty: question.difficulty as Difficulty,
    isFavorite: question.isFavorite,
    isPinned: question.isPinned,
    order: question.order,
    createdAt: question.createdAt.toISOString(),
    updatedAt: question.updatedAt.toISOString(),
    solutions: [...question.solutions]
      .sort((a, b) => a.order - b.order)
      .map(mapSolution)
  };
}

function mapCategoryRow(row: CategoryWithRelations): Category {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parentId,
    order: row.order,
    createdAt: row.createdAt.toISOString(),
    children: [],
    questions: [...row.questions].sort(compareQuestionsByPinAndOrder).map(mapQuestion)
  };
}

export function buildCategoryTree(rows: CategoryWithRelations[]): Category[] {
  const nodes = new Map(rows.map((row) => [row.id, mapCategoryRow(row)]));
  const roots: Category[] = [];

  for (const node of nodes.values()) {
    if (node.parentId && nodes.has(node.parentId)) {
      nodes.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortTree = (categories: Category[]) => {
    categories.sort((a, b) => a.order - b.order);
    for (const category of categories) {
      sortTree(category.children);
    }
  };

  sortTree(roots);
  return roots;
}
