"use server";

import { prisma } from "@/lib/prisma";
import { getOwnedQuestion } from "@/server/access";
import { requireUserId } from "@/server/auth";
import type { TagColor } from "@/types/knowledge";
import { revalidateWorkspace, unauthorized } from "./shared";

export async function createTagAction(input: { name: string; color: TagColor }) {
  let userId: string;
  try { userId = await requireUserId(); } catch { return unauthorized(); }
  try {
    const tag = await prisma.tag.create({ data: { userId, name: input.name.trim(), color: input.color } });
    revalidateWorkspace(userId);
    return { ok: true as const, id: tag.id };
  } catch {
    return { ok: false as const, message: "A tag with this name already exists." };
  }
}

export async function deleteTagAction(input: { tagId: string }) {
  let userId: string;
  try { userId = await requireUserId(); } catch { return unauthorized(); }
  const tag = await prisma.tag.findFirst({ where: { id: input.tagId, userId } });
  if (!tag) return { ok: false as const, message: "Tag not found." };
  await prisma.tag.delete({ where: { id: input.tagId } });
  revalidateWorkspace(userId);
  return { ok: true as const };
}

export async function addTagToQuestionAction(input: { questionId: string; tagId: string }) {
  let userId: string;
  try { userId = await requireUserId(); } catch { return unauthorized(); }
  const question = await getOwnedQuestion(input.questionId, userId);
  if (!question) return { ok: false as const, message: "Question not found." };
  const tag = await prisma.tag.findFirst({ where: { id: input.tagId, userId } });
  if (!tag) return { ok: false as const, message: "Tag not found." };
  await prisma.question.update({ where: { id: input.questionId }, data: { tags: { connect: { id: input.tagId } } } });
  revalidateWorkspace(userId);
  return { ok: true as const };
}

export async function removeTagFromQuestionAction(input: { questionId: string; tagId: string }) {
  let userId: string;
  try { userId = await requireUserId(); } catch { return unauthorized(); }
  const question = await getOwnedQuestion(input.questionId, userId);
  if (!question) return { ok: false as const, message: "Question not found." };
  await prisma.question.update({ where: { id: input.questionId }, data: { tags: { disconnect: { id: input.tagId } } } });
  revalidateWorkspace(userId);
  return { ok: true as const };
}
