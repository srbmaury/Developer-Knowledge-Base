import { KnowledgeBaseApp } from "@/components/knowledge-base-app";
import { getWorkspaceData } from "@/server/queries";
import { filterFavoriteCategories } from "@/lib/workspace-filters";

export default async function StarredPage() {
  const data = await getWorkspaceData();
  const filtered = filterFavoriteCategories(data.categories);

  return (
    <KnowledgeBaseApp
      initialCategories={filtered}
      userEmail={null}
      workspaceTitle="Starred Notes"
      workspaceSubtitle="Your favorite notes"
      canCreateRootCategory={false}
    />
  );
}

