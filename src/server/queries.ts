import { unstable_cache } from "next/cache";
import { buildCategoryTree } from "@/lib/mappers";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireUserId } from "@/server/auth";
import { questionListOrderBy } from "@/server/question-order";
import type { Category } from "@/types/knowledge";

const questionInclude = {
  questions: {
    include: { solutions: true },
    orderBy: questionListOrderBy
  }
} as const;

export async function getWorkspaceData() {
  const userId = await requireUserId();

  return unstable_cache(
    async (uid: string) => {
      const rows = await prisma.category.findMany({
        where: { userId: uid },
        include: questionInclude,
        orderBy: { order: "asc" }
      });

      // First visit: bootstrap a default category so the workspace is never empty.
      // Runs inside the cache so subsequent requests skip this entirely.
      if (rows.length === 0) {
        const defaultCat = await prisma.category.create({
          data: { userId: uid, name: "Getting Started", order: 0 },
          include: questionInclude
        });
        return { categories: buildCategoryTree([defaultCat], uid) };
      }

      return { categories: buildCategoryTree(rows, uid) };
    },
    ["workspace", userId],
    { tags: [`workspace:${userId}`], revalidate: false }
  )(userId);
}

// Caches the viewer-agnostic public rows (canEdit=false for all).
// applyCanEdit re-marks ownership cheaply per-request without hitting the DB.
const fetchPublicCategories = unstable_cache(
  async () => {
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
    return buildCategoryTree(rows, null);
  },
  ["workspace-public"],
  { tags: ["workspace:public"], revalidate: false }
);

function applyCanEdit(categories: Category[], userId: string | null): Category[] {
  return categories.map((cat) => ({
    ...cat,
    canEdit: userId !== null && cat.userId === userId,
    children: applyCanEdit(cat.children, userId)
  }));
}

export async function getPublicWorkspaceData() {
  const user = await getSessionUser();
  const categories = await fetchPublicCategories();
  return {
    categories: applyCanEdit(categories, user?.id ?? null)
  };
}
