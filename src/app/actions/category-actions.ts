"use server";

import { prisma } from "@/lib/prisma";
import { getOwnedCategory } from "@/server/access";
import { requireUserId } from "@/server/auth";
import { revalidateWorkspace, unauthorized } from "./shared";

export async function createCategoryAction(input: { name: string; parentId?: string | null; order?: number }) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return unauthorized();
  }

  if (!input.name.trim()) {
    return { ok: false as const, message: "Category name is required." };
  }

  if (input.parentId) {
    const parent = await getOwnedCategory(input.parentId, userId);
    if (!parent) {
      return { ok: false as const, message: "Parent category not found." };
    }
  }

  const siblings = await prisma.category.count({
    where: { parentId: input.parentId ?? null, userId }
  });

  const category = await prisma.category.create({
    data: {
      userId,
      name: input.name.trim(),
      parentId: input.parentId ?? null,
      order: input.order ?? siblings
    }
  });

  revalidateWorkspace(userId);
  return { ok: true as const, id: category.id };
}

export async function updateCategoryAction(input: { categoryId: string; name: string }) {
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

  await prisma.category.update({
    where: { id: input.categoryId },
    data: { name: input.name.trim() }
  });

  revalidateWorkspace(userId);
  return { ok: true as const };
}

export async function updateCategoryVisibilityAction(input: { categoryId: string; isPublic: boolean }) {
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

  await prisma.category.update({
    where: { id: input.categoryId },
    data: { isPublic: input.isPublic }
  });

  revalidateWorkspace(userId);
  return { ok: true as const };
}

export async function deleteCategoryAction(input: { categoryId: string }) {
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

  await prisma.category.delete({ where: { id: input.categoryId } });
  revalidateWorkspace(userId);
  return { ok: true as const };
}

export async function reorderCategoriesAction(input: { parentId?: string | null; categoryIds: string[] }) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return unauthorized();
  }

  const categories = await prisma.category.findMany({
    where: { parentId: input.parentId ?? null, userId },
    select: { id: true }
  });

  const currentIds = new Set(categories.map((category) => category.id));

  if (
    input.categoryIds.length !== currentIds.size ||
    input.categoryIds.some((id) => !currentIds.has(id))
  ) {
    return { ok: false as const, message: "Category list does not match current children." };
  }

  const updates = input.categoryIds.map((id, index) => ({ id, order: index }));

  await prisma.$transaction(
    updates.map(({ id, order }) =>
      prisma.category.update({
        where: { id },
        data: { order }
      })
    )
  );

  revalidateWorkspace(userId);
  return { ok: true as const };
}
