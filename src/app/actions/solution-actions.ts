"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getOwnedQuestion, getOwnedSolution } from "@/server/access";
import { requireUserId } from "@/server/auth";
import type { SolutionLanguage } from "@/types/knowledge";
import type { ReviewResult } from "@/lib/ai-answer";
import { revalidateWorkspace, unauthorized } from "./shared";

export async function createSolutionAction(input: { questionId: string; title: string; language?: SolutionLanguage }) {
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
  const previousSolution = input.language === undefined
    ? await prisma.solution.findFirst({
        where: { questionId: input.questionId },
        orderBy: { order: "desc" },
        select: { language: true }
      })
    : null;
  const solution = await prisma.solution.create({
    data: {
      questionId: input.questionId,
      title: input.title.trim() || "Untitled approach",
      language: input.language ?? previousSolution?.language ?? "none",
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
  aiReview?: ReviewResult | null;
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
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.aiReview !== undefined ? { aiReview: input.aiReview === null ? Prisma.DbNull : input.aiReview } : {})
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

export async function getSolutionContentAction(solutionId: string) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return unauthorized();
  }

  const solution = await prisma.solution.findFirst({
    where: { id: solutionId, question: { category: { userId } } },
    select: { content: true, notes: true, aiReview: true }
  });

  if (!solution) {
    return { ok: false as const, message: "Solution not found." };
  }

  return {
    ok: true as const,
    content: solution.content,
    notes: solution.notes,
    aiReview: solution.aiReview as ReviewResult | null
  };
}
