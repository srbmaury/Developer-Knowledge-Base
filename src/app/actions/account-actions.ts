"use server";

import { prisma } from "@/lib/prisma";
import { requireUserId, getSessionUser } from "@/server/auth";
import { unauthorized } from "./shared";

export async function deleteAccountAction() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return unauthorized();
  }

  // Delete all user data — cascade handles questions, solutions, tags
  await prisma.category.deleteMany({ where: { userId } });
  await prisma.tag.deleteMany({ where: { userId } });
  await prisma.issueReport.deleteMany({ where: { userId } });

  // Delete the Supabase auth account
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    return { ok: false as const, message: "Data deleted but auth account removal failed. Contact support." };
  }

  return { ok: true as const };
}

export async function reportIssueAction(input: { title: string; description: string }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const title = input.title.trim();
  const description = input.description.trim();

  if (!title) return { ok: false as const, message: "Title is required." };
  if (!description) return { ok: false as const, message: "Description is required." };
  if (title.length > 200) return { ok: false as const, message: "Title too long (max 200 chars)." };
  if (description.length > 5000) return { ok: false as const, message: "Description too long (max 5000 chars)." };

  await prisma.issueReport.create({
    data: { userId: user.id, userEmail: user.email ?? "", title, description },
  });

  return { ok: true as const };
}
