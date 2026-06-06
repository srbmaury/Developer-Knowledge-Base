import { redirect } from "next/navigation";
import { MostViewedClient } from "@/components/most-viewed-client";
import { getSessionUser } from "@/server/auth";
import { getWorkspaceData } from "@/server/queries";

export default async function MostViewedPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const data = await getWorkspaceData();

  return <MostViewedClient initialCategories={data.categories} userEmail={user.email} />;
}


