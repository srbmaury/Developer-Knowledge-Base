import { buildCategoryTree } from "@/lib/mappers";
import { prisma } from "@/lib/prisma";
import { questionListOrderBy } from "@/server/question-order";

export async function getWorkspaceData() {
  const rows = await prisma.category.findMany({
    include: {
      questions: {
        include: { solutions: true },
        orderBy: questionListOrderBy
      }
    },
    orderBy: { order: "asc" }
  });

  return {
    categories: buildCategoryTree(rows)
  };
}
