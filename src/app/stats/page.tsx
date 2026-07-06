import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth";
import { getWorkspaceData } from "@/server/queries";
import { StatsClient } from "@/components/stats-client";

export default async function StatsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const data = await getWorkspaceData();

  const isAdmin = !!process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL;
  return <StatsClient initialCategories={data.categories} userEmail={user.email} isAdmin={isAdmin} />;
}
