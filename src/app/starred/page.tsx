import { redirect } from "next/navigation";
import { KnowledgeBaseApp } from "@/components/knowledge-base-app";
import { getSessionUser } from "@/server/auth";
import { getWorkspaceData } from "@/server/queries";
import { filterFavoriteCategories } from "@/lib/workspace-filters";

export default async function StarredPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const data = await getWorkspaceData();
  const filtered = filterFavoriteCategories(data.categories);

  const isAdmin = !!process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL;
  return (
    <KnowledgeBaseApp
      initialCategories={filtered}
      initialTags={data.tags}
      userEmail={user.email}
      isAdmin={isAdmin}
      canCreateRootCategory={false}
      emptyMessage="Star some notes from your workspace to see them here."
    />
  );
}

