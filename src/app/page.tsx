import { redirect } from "next/navigation";
import { KnowledgeBaseApp } from "@/components/knowledge-base-app";
import { getSessionUser } from "@/server/auth";
import { getWorkspaceData } from "@/server/queries";

export default async function Home() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const data = await getWorkspaceData();

  return <KnowledgeBaseApp initialCategories={data.categories} userEmail={user.email} />;
}
