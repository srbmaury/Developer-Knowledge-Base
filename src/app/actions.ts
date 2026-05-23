"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  assignOrdersByPinGroups,
  getNextQuestionOrder
} from "@/server/question-order";
import type { Difficulty, SolutionLanguage } from "@/types/knowledge";

export async function createCategoryAction(input: { name: string; parentId?: string | null; order?: number }) {
  if (!input.name.trim()) {
    return { ok: false as const, message: "Category name is required." };
  }

  const siblings = await prisma.category.count({
    where: { parentId: input.parentId ?? null }
  });

  const category = await prisma.category.create({
    data: {
      name: input.name.trim(),
      parentId: input.parentId ?? null,
      order: input.order ?? siblings
    }
  });

  revalidatePath("/");
  return { ok: true as const, id: category.id };
}

export async function updateCategoryAction(input: { categoryId: string; name: string }) {
  await prisma.category.update({
    where: { id: input.categoryId },
    data: { name: input.name.trim() }
  });

  revalidatePath("/");
  return { ok: true as const };
}

export async function deleteCategoryAction(input: { categoryId: string }) {
  await prisma.category.delete({ where: { id: input.categoryId } });
  revalidatePath("/");
  return { ok: true as const };
}

export async function createQuestionAction(input: {
  categoryId: string;
  title: string;
  description?: string;
  difficulty?: Difficulty;
  order?: number;
}) {
  if (!input.title.trim() && input.title !== "") {
    return { ok: false as const, message: "Question title is required." };
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
          language: "typescript",
          content: "",
          notes: "",
          order: 0
        }
      }
    },
    include: { solutions: true }
  });

  revalidatePath("/");
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
  const existing = await prisma.question.findUnique({
    where: { id: input.questionId },
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

  revalidatePath("/");
  return { ok: true as const };
}

export async function deleteQuestionAction(input: { questionId: string }) {
  await prisma.question.delete({ where: { id: input.questionId } });
  revalidatePath("/");
  return { ok: true as const };
}

export async function reorderQuestionsAction(input: { categoryId: string; questionIds: string[] }) {
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

  revalidatePath("/");
  return { ok: true as const };
}

export async function createSolutionAction(input: { questionId: string; title: string }) {
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

  revalidatePath("/");
  return { ok: true as const, id: solution.id };
}

export async function updateSolutionAction(input: {
  solutionId: string;
  title?: string;
  language?: SolutionLanguage;
  content?: string;
  notes?: string;
}) {
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

  revalidatePath("/");
  return { ok: true as const };
}

export async function deleteSolutionAction(input: { solutionId: string }) {
  const solution = await prisma.solution.findUnique({
    where: { id: input.solutionId },
    select: { questionId: true }
  });

  if (!solution) {
    return { ok: false as const, message: "Approach not found." };
  }

  const count = await prisma.solution.count({ where: { questionId: solution.questionId } });
  if (count <= 1) {
    return { ok: false as const, message: "Cannot delete the only approach for this question." };
  }

  await prisma.solution.delete({ where: { id: input.solutionId } });

  await prisma.question.update({
    where: { id: solution.questionId },
    data: { updatedAt: new Date() }
  });

  revalidatePath("/");
  return { ok: true as const };
}
