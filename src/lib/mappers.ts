import type { Prisma } from "@prisma/client";
import { compareQuestionsByPinAndOrder } from "@/lib/question-order";
import type { Category, Difficulty, Question, QuestionStatus, Solution, SolutionLanguage, Tag, TagColor } from "@/types/knowledge";
import type { ReviewResult } from "@/lib/ai-answer";

type CategoryWithRelations = Prisma.CategoryGetPayload<{
  include: {
    questions: {
      include: { solutions: true; tags: true };
    };
  };
}>;

function toTagColor(value: string): TagColor {
  const allowed: TagColor[] = ["gray", "red", "orange", "yellow", "green", "blue", "purple", "pink"];
  return allowed.includes(value as TagColor) ? (value as TagColor) : "blue";
}

export function mapTag(tag: { id: string; name: string; color: string }): Tag {
  return { id: tag.id, name: tag.name, color: toTagColor(tag.color) };
}

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
    aiReview: (solution.aiReview as ReviewResult | null) ?? null,
    order: solution.order,
    createdAt: solution.createdAt.toISOString(),
    updatedAt: solution.updatedAt.toISOString()
  };
}

const VALID_STATUSES: QuestionStatus[] = ["NOT_STARTED", "IN_PROGRESS", "SOLVED"];

function toQuestionStatus(value: string): QuestionStatus {
  return VALID_STATUSES.includes(value as QuestionStatus) ? (value as QuestionStatus) : "NOT_STARTED";
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
    status: toQuestionStatus(question.status),
    srDue: question.srDue?.toISOString() ?? null,
    srInterval: question.srInterval,
    srEase: question.srEase,
    srReviews: question.srReviews,
    createdAt: question.createdAt.toISOString(),
    updatedAt: question.updatedAt.toISOString(),
    solutions: [...question.solutions]
      .sort((a, b) => a.order - b.order)
      .map(mapSolution),
    tags: question.tags.map(mapTag)
  };
}

function mapCategoryRow(row: CategoryWithRelations, viewerUserId: string | null): Category {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    isPublic: row.isPublic,
    canEdit: viewerUserId !== null && row.userId === viewerUserId,
    parentId: row.parentId,
    order: row.order,
    createdAt: row.createdAt.toISOString(),
    children: [],
    questions: [...row.questions].sort(compareQuestionsByPinAndOrder).map(mapQuestion)
  };
}

export function buildCategoryTree(rows: CategoryWithRelations[], viewerUserId: string | null): Category[] {
  const nodes = new Map(rows.map((row) => [row.id, mapCategoryRow(row, viewerUserId)]));
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
