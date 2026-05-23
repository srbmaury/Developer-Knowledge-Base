import { buildCategoryTree } from "@/lib/mappers";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireUserId } from "@/server/auth";
import { questionListOrderBy } from "@/server/question-order";
import { ensureDefaultWorkspace } from "@/server/workspace-bootstrap";

export async function getWorkspaceData() {
  const userId = await requireUserId();
  await ensureDefaultWorkspace(userId);

  const rows = await prisma.category.findMany({
    where: { userId },
    include: {
      questions: {
        include: { solutions: true },
        orderBy: questionListOrderBy
      }
    },
    orderBy: { order: "asc" }
  });

  return {
    categories: buildCategoryTree(rows, userId)
  };
}

export async function getPublicWorkspaceData() {
  const user = await getSessionUser();

  const rows = await prisma.category.findMany({
    where: { isPublic: true },
    include: {
      questions: {
        include: { solutions: true },
        orderBy: questionListOrderBy
      }
    },
    orderBy: { order: "asc" }
  });

  return {
    categories: buildCategoryTree(rows, user?.id ?? null),
    user
  };
}
