import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth";
import { getWorkspaceData } from "@/server/queries";
import { StatsClient } from "@/components/stats-client";

export default async function StatsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const data = await getWorkspaceData();

  return <StatsClient initialCategories={data.categories} userEmail={user.email} />;
}
