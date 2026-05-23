import { prisma } from "@/lib/prisma";

export async function getOwnedCategory(categoryId: string, userId: string) {
  return prisma.category.findFirst({
    where: { id: categoryId, userId }
  });
}

export async function getOwnedQuestion(questionId: string, userId: string) {
  return prisma.question.findFirst({
    where: {
      id: questionId,
      category: { userId }
    }
  });
}

export async function getOwnedSolution(solutionId: string, userId: string) {
  return prisma.solution.findFirst({
    where: {
      id: solutionId,
      question: { category: { userId } }
    },
    select: { id: true, questionId: true }
  });
}
