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

  const isAdmin = !!process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL;
  return <KnowledgeBaseApp initialCategories={data.categories} initialTags={data.tags} userEmail={user.email} isAdmin={isAdmin} />;
}
