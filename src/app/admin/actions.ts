"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";

function assertAdmin(email: string | null | undefined) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || email !== adminEmail) throw new Error("Unauthorized");
}

export async function deleteUserAction(userId: string) {
  const caller = await getSessionUser();
  assertAdmin(caller?.email);

  if (userId === caller?.id) {
    throw new Error("Cannot delete your own account through the admin panel.");
  }

  // Delete DB data first so we can fail safely before touching auth.
  // Category cascade → Question → Solution (via FK ON DELETE CASCADE in DB).
  // Tags have no FK to categories so must be deleted explicitly.
  await prisma.category.deleteMany({ where: { userId } });
  await prisma.tag.deleteMany({ where: { userId } });

  // Remove from Supabase auth last — point of no return.
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(`Supabase auth delete failed: ${error.message}`);

  revalidatePath("/admin");
  return { ok: true as const };
}

export async function resolveIssueAction(issueId: string) {
  const caller = await getSessionUser();
  assertAdmin(caller?.email);

  await prisma.issueReport.update({
    where: { id: issueId },
    data: { resolved: true, resolvedAt: new Date() },
  });

  revalidatePath("/admin");
}

export async function deleteIssueAction(issueId: string) {
  const caller = await getSessionUser();
  assertAdmin(caller?.email);

  await prisma.issueReport.delete({ where: { id: issueId } });
  revalidatePath("/admin");
}
