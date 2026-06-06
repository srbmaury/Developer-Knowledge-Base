"use server";

import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getOwnedCategory, getOwnedQuestion, getOwnedSolution } from "@/server/access";
import { requireUserId } from "@/server/auth";
import {
  assignOrdersByPinGroups,
  getNextQuestionOrder
} from "@/server/question-order";
import type { Difficulty, SolutionLanguage } from "@/types/knowledge";

async function unauthorized() {
  return { ok: false as const, message: "You must be signed in." };
}

function revalidateWorkspace(userId: string) {
  revalidateTag(`workspace:${userId}`);
  revalidateTag("workspace:public");
}

export async function createCategoryAction(input: { name: string; parentId?: string | null; order?: number }) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return unauthorized();
  }

  if (!input.name.trim()) {
    return { ok: false as const, message: "Category name is required." };
  }

  if (input.parentId) {
    const parent = await getOwnedCategory(input.parentId, userId);
    if (!parent) {
      return { ok: false as const, message: "Parent category not found." };
    }
  }

  const siblings = await prisma.category.count({
    where: { parentId: input.parentId ?? null, userId }
  });

  const category = await prisma.category.create({
    data: {
      userId,
      name: input.name.trim(),
      parentId: input.parentId ?? null,
      order: input.order ?? siblings
    }
  });

  revalidateWorkspace(userId);
  return { ok: true as const, id: category.id };
}

export async function updateCategoryAction(input: { categoryId: string; name: string }) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return unauthorized();
  }

  const category = await getOwnedCategory(input.categoryId, userId);
  if (!category) {
    return { ok: false as const, message: "Category not found." };
  }

  await prisma.category.update({
    where: { id: input.categoryId },
    data: { name: input.name.trim() }
  });

  revalidateWorkspace(userId);
  return { ok: true as const };
}

export async function updateCategoryVisibilityAction(input: { categoryId: string; isPublic: boolean }) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return unauthorized();
  }

  const category = await getOwnedCategory(input.categoryId, userId);
  if (!category) {
    return { ok: false as const, message: "Category not found." };
  }

  await prisma.category.update({
    where: { id: input.categoryId },
    data: { isPublic: input.isPublic }
  });

  revalidateWorkspace(userId);
  return { ok: true as const };
}

export async function deleteCategoryAction(input: { categoryId: string }) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return unauthorized();
  }

  const category = await getOwnedCategory(input.categoryId, userId);
  if (!category) {
    return { ok: false as const, message: "Category not found." };
  }

  await prisma.category.delete({ where: { id: input.categoryId } });
  revalidateWorkspace(userId);
  return { ok: true as const };
}

export async function reorderCategoriesAction(input: { parentId?: string | null; categoryIds: string[] }) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return unauthorized();
  }

  const categories = await prisma.category.findMany({
    where: { parentId: input.parentId ?? null, userId },
    select: { id: true }
  });

  const currentIds = new Set(categories.map((category) => category.id));

  if (
    input.categoryIds.length !== currentIds.size ||
    input.categoryIds.some((id) => !currentIds.has(id))
  ) {
    return { ok: false as const, message: "Category list does not match current children." };
  }

  const updates = input.categoryIds.map((id, index) => ({ id, order: index }));

  await prisma.$transaction(
    updates.map(({ id, order }) =>
      prisma.category.update({
        where: { id },
        data: { order }
      })
    )
  );

  revalidateWorkspace(userId);
  return { ok: true as const };
}

export async function createQuestionAction(input: {
  categoryId: string;
  title: string;
  description?: string;
  difficulty?: Difficulty;
  order?: number;
  defaultLanguage?: SolutionLanguage;
}) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return unauthorized();
  }

  const category = await getOwnedCategory(input.categoryId, userId);
  if (!category) {
    return { ok: false as const, message: "Category not found." };
  }

  const isPinned = false;
  const order = input.order ?? (await getNextQuestionOrder(prisma, input.categoryId, isPinned));

  const question = await prisma.question.create({
    data: {
      categoryId: input.categoryId,
          title: input.title.trim(),
      description: input.description ?? "",
      difficulty: input.difficulty ?? "MEDIUM",
      isPinned,
      order,
      solutions: {
        create: {
          title: "Best Approach",
          language: input.defaultLanguage ?? "typescript",
          content: "",
          notes: "",
          order: 0
        }
      }
    },
    include: { solutions: true }
  });


  revalidateWorkspace(userId);
  return {
    ok: true as const,
    question: {
      id: question.id,
      solutionId: question.solutions[0]?.id ?? null
    }
  };
}

export async function updateQuestionAction(input: {
  questionId: string;
  title?: string;
  description?: string;
  difficulty?: Difficulty;
  isFavorite?: boolean;
  isPinned?: boolean;
}) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return unauthorized();
  }

  const existing = await prisma.question.findFirst({
    where: { id: input.questionId, category: { userId } },
    select: { categoryId: true, isPinned: true }
  });

  if (!existing) {
    return { ok: false as const, message: "Question not found." };
  }

  const pinChanged = input.isPinned !== undefined && input.isPinned !== existing.isPinned;
  const order =
    pinChanged && input.isPinned !== undefined
      ? await getNextQuestionOrder(prisma, existing.categoryId, input.isPinned)
      : undefined;

  await prisma.question.update({
    where: { id: input.questionId },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.difficulty !== undefined ? { difficulty: input.difficulty } : {}),
      ...(input.isFavorite !== undefined ? { isFavorite: input.isFavorite } : {}),
      ...(input.isPinned !== undefined ? { isPinned: input.isPinned } : {}),
      ...(order !== undefined ? { order } : {})
    }
  });

  revalidateWorkspace(userId);
  return { ok: true as const };
}

export async function deleteQuestionAction(input: { questionId: string }) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return unauthorized();
  }

  const question = await getOwnedQuestion(input.questionId, userId);
  if (!question) {
    return { ok: false as const, message: "Question not found." };
  }

  await prisma.question.delete({ where: { id: input.questionId } });
  revalidateWorkspace(userId);
  return { ok: true as const };
}

export async function reorderQuestionsAction(input: { categoryId: string; questionIds: string[] }) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return unauthorized();
  }

  const category = await getOwnedCategory(input.categoryId, userId);
  if (!category) {
    return { ok: false as const, message: "Category not found." };
  }

  const questions = await prisma.question.findMany({
    where: { id: { in: input.questionIds }, categoryId: input.categoryId },
    select: { id: true, isPinned: true }
  });
  const byId = new Map(questions.map((question) => [question.id, question]));
  const updates = assignOrdersByPinGroups(input.questionIds, byId);

  await prisma.$transaction(
    updates.map(({ id, order }) =>
      prisma.question.update({
        where: { id },
        data: { order }
      })
    )
  );

  revalidateWorkspace(userId);
  return { ok: true as const };
}

export async function createSolutionAction(input: { questionId: string; title: string }) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return unauthorized();
  }

  const question = await getOwnedQuestion(input.questionId, userId);
  if (!question) {
    return { ok: false as const, message: "Question not found." };
  }

  const count = await prisma.solution.count({ where: { questionId: input.questionId } });
  const solution = await prisma.solution.create({
    data: {
      questionId: input.questionId,
      title: input.title.trim() || "Untitled approach",
      language: "none",
      content: "",
      notes: "",
      order: count
    }
  });

  revalidateWorkspace(userId);
  return { ok: true as const, id: solution.id };
}

export async function updateSolutionAction(input: {
  solutionId: string;
  title?: string;
  language?: SolutionLanguage;
  content?: string;
  notes?: string;
}) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return unauthorized();
  }

  const owned = await getOwnedSolution(input.solutionId, userId);
  if (!owned) {
    return { ok: false as const, message: "Approach not found." };
  }

  const solution = await prisma.solution.update({
    where: { id: input.solutionId },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.language !== undefined ? { language: input.language } : {}),
      ...(input.content !== undefined ? { content: input.content } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {})
    },
    select: { questionId: true }
  });

  await prisma.question.update({
    where: { id: solution.questionId },
    data: { updatedAt: new Date() }
  });

  revalidateWorkspace(userId);
  return { ok: true as const };
}

export async function deleteSolutionAction(input: { solutionId: string }) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return unauthorized();
  }

  const solution = await getOwnedSolution(input.solutionId, userId);
  if (!solution) {
    return { ok: false as const, message: "Approach not found." };
  }

  // Single atomic statement: delete only when another solution exists for the same question.
  // Avoids the race between a separate count check and the delete.
  const deleted: number = await prisma.$executeRaw`
    DELETE FROM "Solution"
    WHERE id = ${input.solutionId}
      AND (
        SELECT COUNT(*) FROM "Solution"
        WHERE "questionId" = ${solution.questionId}
      ) > 1
  `;

  if (deleted === 0) {
    return { ok: false as const, message: "Cannot delete the only approach for this question." };
  }

  await prisma.question.update({
    where: { id: solution.questionId },
    data: { updatedAt: new Date() }
  });

  revalidateWorkspace(userId);
  return { ok: true as const };
}
