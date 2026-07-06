import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser } from "@/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { prisma } from "@/lib/prisma";
import { AdminClient } from "./admin-client";

export const metadata: Metadata = { title: "Admin – Developer Knowledge Base" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSessionUser();
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || session?.email !== adminEmail) redirect("/");

  // Supabase user list
  let supabaseAdmin;
  try {
    supabaseAdmin = createAdminClient();
  } catch {
    return <MisconfiguredBanner message="SUPABASE_SERVICE_ROLE_KEY is not set or is incorrect." />;
  }

  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) {
    return <MisconfiguredBanner message={`Supabase admin API error: ${error.message}`} />;
  }

  // Per-user category and question aggregates from our DB
  const [categoryRows, questionRows, globalStats, issues] = await Promise.all([
    prisma.category.groupBy({ by: ["userId"], _count: { id: true } }),
    prisma.category.findMany({
      select: { userId: true, _count: { select: { questions: true } } },
    }),
    prisma.$transaction([
      prisma.category.count(),
      prisma.question.count(),
      prisma.solution.count(),
    ]),
    prisma.issueReport.findMany({
      orderBy: [{ resolved: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  const catCountByUser = Object.fromEntries(categoryRows.map((r) => [r.userId, r._count.id]));
  const qCountByUser: Record<string, number> = {};
  for (const row of questionRows) {
    qCountByUser[row.userId] = (qCountByUser[row.userId] ?? 0) + row._count.questions;
  }

  const users = data.users.map((u) => ({
    id: u.id,
    email: u.email ?? "(no email)",
    verified: !!u.email_confirmed_at,
    createdAt: u.created_at,
    lastSignIn: u.last_sign_in_at ?? null,
    categories: catCountByUser[u.id] ?? 0,
    questions: qCountByUser[u.id] ?? 0,
  }));

  users.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const [totalCategories, totalQuestions, totalSolutions] = globalStats;
  const verifiedCount = users.filter((u) => u.verified).length;
  const activeUsers = users.filter((u) => u.questions > 0).length;

  const stats = {
    users: users.length,
    verified: verifiedCount,
    active: activeUsers,
    categories: totalCategories,
    questions: totalQuestions,
    solutions: totalSolutions,
    openIssues: issues.filter((i) => !i.resolved).length,
  };

  return <AdminClient users={users} stats={stats} adminEmail={adminEmail} issues={issues} />;
}

function MisconfiguredBanner({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6">
        <h2 className="mb-2 font-semibold text-destructive">Admin setup required</h2>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
