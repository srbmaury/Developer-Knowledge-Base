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

  return (
    <KnowledgeBaseApp
      initialCategories={filtered}
      userEmail={user.email}
      workspaceTitle="Starred Notes"
      workspaceSubtitle="Your favorite notes"
      canCreateRootCategory={false}
    />
  );
}

