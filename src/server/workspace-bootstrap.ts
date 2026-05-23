import { prisma } from "@/lib/prisma";

/** Ensures every signed-in user has at least one root category. */
export async function ensureDefaultWorkspace(userId: string) {
  const count = await prisma.category.count({ where: { userId } });
  if (count > 0) return;

  await prisma.category.create({
    data: {
      userId,
      name: "Getting Started",
      order: 0
    }
  });
}
