"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getOwnedCategory, getOwnedQuestion } from "@/server/access";
import { requireUserId } from "@/server/auth";
import { assignOrdersByPinGroups, getNextQuestionOrder } from "@/server/question-order";
import type { Difficulty, QuestionStatus, SolutionLanguage } from "@/types/knowledge";
import type { ReviewResult } from "@/lib/ai-answer";
import type { SRGrade } from "@/lib/spaced-repetition";
import { revalidateWorkspace, unauthorized } from "./shared";

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

export async function bulkSaveAction(input: {
  questions?: Array<{ questionId: string; title?: string; description?: string; difficulty?: Difficulty }>;
  solutions?: Array<{
    solutionId: string;
    title?: string;
    language?: SolutionLanguage;
    content?: string;
    notes?: string;
    aiReview?: ReviewResult | null;
  }>;
}) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return unauthorized();
  }

  const questionPatches = input.questions ?? [];
  const solutionPatches = input.solutions ?? [];

  const questionIds = [...new Set(questionPatches.map((patch) => patch.questionId))];
  const solutionIds = [...new Set(solutionPatches.map((patch) => patch.solutionId))];

  const ownedQuestions = questionIds.length
    ? await prisma.question.findMany({
        where: { id: { in: questionIds }, category: { userId } },
        select: { id: true }
      })
    : [];

  const ownedSolutions = solutionIds.length
    ? await prisma.solution.findMany({
        where: { id: { in: solutionIds }, question: { category: { userId } } },
        select: { id: true, questionId: true }
      })
    : [];

  if (ownedQuestions.length !== questionIds.length || ownedSolutions.length !== solutionIds.length) {
    return { ok: false as const, message: "Some items could not be saved." };
  }

  const solutionQuestionIds = [...new Set(ownedSolutions.map((solution) => solution.questionId))];

  const updates: Array<Prisma.PrismaPromise<unknown>> = [];

  for (const patch of questionPatches) {
    const data: Record<string, unknown> = {};
    if (patch.title !== undefined) data.title = patch.title.trim();
    if (patch.description !== undefined) data.description = patch.description;
    if (patch.difficulty !== undefined) data.difficulty = patch.difficulty;
    if (Object.keys(data).length === 0) continue;
    updates.push(
      prisma.question.update({
        where: { id: patch.questionId },
        data
      })
    );
  }

  for (const patch of solutionPatches) {
    const data: Record<string, unknown> = {};
    if (patch.title !== undefined) data.title = patch.title.trim();
    if (patch.language !== undefined) data.language = patch.language;
    if (patch.content !== undefined) data.content = patch.content;
    if (patch.notes !== undefined) data.notes = patch.notes;
    if (patch.aiReview !== undefined) {
      data.aiReview = patch.aiReview === null ? Prisma.DbNull : patch.aiReview;
    }
    if (Object.keys(data).length === 0) continue;
    updates.push(
      prisma.solution.update({
        where: { id: patch.solutionId },
        data
      })
    );
  }

  for (const questionId of solutionQuestionIds) {
    updates.push(
      prisma.question.update({
        where: { id: questionId },
        data: { updatedAt: new Date() }
      })
    );
  }

  if (updates.length > 0) {
    await prisma.$transaction(updates);
  }

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
    where: { categoryId: input.categoryId },
    select: { id: true, isPinned: true }
  });
  const currentIds = new Set(questions.map((q) => q.id));
  if (
    input.questionIds.length !== currentIds.size ||
    input.questionIds.some((id) => !currentIds.has(id))
  ) {
    return { ok: false as const, message: "Question list does not match current category." };
  }
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

export async function updateQuestionStatusAction(input: { questionId: string; status: QuestionStatus }) {
  let userId: string;
  try { userId = await requireUserId(); } catch { return unauthorized(); }
  const question = await getOwnedQuestion(input.questionId, userId);
  if (!question) return { ok: false as const, message: "Question not found." };
  await prisma.question.update({ where: { id: input.questionId }, data: { status: input.status } });
  revalidateWorkspace(userId);
  return { ok: true as const };
}

export async function submitSpacedReviewAction(input: { questionId: string; grade: SRGrade }) {
  let userId: string;
  try { userId = await requireUserId(); } catch { return unauthorized(); }
  const question = await getOwnedQuestion(input.questionId, userId);
  if (!question) return { ok: false as const, message: "Question not found." };

  const { computeNextSR } = await import("@/lib/spaced-repetition");
  const next = computeNextSR(
    { interval: question.srInterval, ease: question.srEase, reviews: question.srReviews },
    input.grade
  );
  await prisma.question.update({
    where: { id: input.questionId },
    data: { srDue: new Date(next.due), srInterval: next.interval, srEase: next.ease, srReviews: next.reviews }
  });
  revalidateWorkspace(userId);
  return { ok: true as const, next };
}

export async function moveQuestionAction(input: { questionId: string; targetCategoryId: string }) {
  let userId: string;
  try { userId = await requireUserId(); } catch { return unauthorized(); }
  const question = await getOwnedQuestion(input.questionId, userId);
  if (!question) return { ok: false as const, message: "Question not found." };
  const target = await getOwnedCategory(input.targetCategoryId, userId);
  if (!target) return { ok: false as const, message: "Target category not found." };
  const order = await prisma.question.count({ where: { categoryId: input.targetCategoryId } });
  await prisma.question.update({
    where: { id: input.questionId },
    data: { categoryId: input.targetCategoryId, order, isPinned: false }
  });
  revalidateWorkspace(userId);
  return { ok: true as const };
}

export async function enrollInReviewAction(input: { questionId: string }) {
  let userId: string;
  try { userId = await requireUserId(); } catch { return unauthorized(); }
  const question = await getOwnedQuestion(input.questionId, userId);
  if (!question) return { ok: false as const, message: "Question not found." };

  const due = new Date(); // due immediately
  await prisma.question.update({
    where: { id: input.questionId },
    data: { srDue: due }
  });
  revalidateWorkspace(userId);
  return { ok: true as const, srDue: due.toISOString() };
}

export async function unenrollFromReviewAction(input: { questionId: string }) {
  let userId: string;
  try { userId = await requireUserId(); } catch { return unauthorized(); }
  const question = await getOwnedQuestion(input.questionId, userId);
  if (!question) return { ok: false as const, message: "Question not found." };

  await prisma.question.update({
    where: { id: input.questionId },
    data: { srDue: null, srInterval: 1, srEase: 2.5, srReviews: 0 }
  });
  revalidateWorkspace(userId);
  return { ok: true as const };
}
