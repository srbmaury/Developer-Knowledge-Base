import { KnowledgeBaseApp } from "@/components/knowledge-base-app";
import { getPublicWorkspaceData } from "@/server/queries";

export default async function PublicPage() {
  const data = await getPublicWorkspaceData();

  return (
    <KnowledgeBaseApp
      initialCategories={data.categories}
      userEmail={data.user?.email ?? null}
      workspaceTitle="Public Knowledge Base"
      workspaceSubtitle="Published notes"
      canCreateRootCategory={false}
    />
  );
}
