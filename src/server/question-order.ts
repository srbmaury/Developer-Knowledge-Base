import type { Prisma, PrismaClient } from "@prisma/client";

export {
  assignOrdersByPinGroups,
  compareQuestionsByPinAndOrder,
  normalizeQuestionIdsForReorder
} from "@/lib/question-order";

/** Prisma orderBy for question lists (pinned first, then order within group). */
export const questionListOrderBy: Prisma.QuestionOrderByWithRelationInput[] = [
  { isPinned: "desc" },
  { order: "asc" }
];

export async function getNextQuestionOrder(
  prisma: PrismaClient,
  categoryId: string,
  isPinned: boolean
) {
  return prisma.question.count({
    where: { categoryId, isPinned }
  });
}
