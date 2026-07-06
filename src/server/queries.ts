import { unstable_cache } from "next/cache";
import { buildCategoryTree, buildSlimCategoryTree, mapTag } from "@/lib/mappers";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireUserId } from "@/server/auth";
import { questionListOrderBy } from "@/server/question-order";
import type { Category, Tag } from "@/types/knowledge";

const solutionSelect = {
  id: true,
  questionId: true,
  title: true,
  language: true,
  order: true,
  createdAt: true,
  updatedAt: true,
} as const;

const questionInclude = {
  questions: {
    include: { solutions: { select: solutionSelect }, tags: true },
    orderBy: questionListOrderBy
  }
} as const;

export async function getWorkspaceData() {
  const userId = await requireUserId();

  return unstable_cache(
    async (uid: string) => {
      const [rows, tagRows] = await Promise.all([
        prisma.category.findMany({
          where: { userId: uid },
          include: questionInclude,
          orderBy: { order: "asc" }
        }),
        prisma.tag.findMany({ where: { userId: uid }, orderBy: { name: "asc" } })
      ]);

      const tags: Tag[] = tagRows.map(mapTag);

      if (rows.length === 0) {
        // Guard against duplicate creation on concurrent first-load: check once more before inserting
        const alreadyExists = await prisma.category.findFirst({ where: { userId: uid }, select: { id: true } });
        if (alreadyExists) {
          const freshRows = await prisma.category.findMany({
            where: { userId: uid },
            include: questionInclude,
            orderBy: { order: "asc" },
          });
          return { categories: buildSlimCategoryTree(freshRows, uid), tags };
        }
        const defaultCat = await prisma.category.create({
          data: { userId: uid, name: "Getting Started", order: 0 },
          include: questionInclude,
        });
        return { categories: buildSlimCategoryTree([defaultCat], uid), tags };
      }

      return { categories: buildSlimCategoryTree(rows, uid), tags };
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
          include: { solutions: true, tags: true },
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
