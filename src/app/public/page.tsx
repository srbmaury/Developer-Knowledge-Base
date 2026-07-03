import { KnowledgeBaseApp } from "@/components/knowledge-base-app";
import { getSessionUser } from "@/server/auth";
import { getPublicWorkspaceData } from "@/server/queries";

export default async function PublicPage() {
  const [data, viewer] = await Promise.all([getPublicWorkspaceData(), getSessionUser()]);

  return (
    <KnowledgeBaseApp
      initialCategories={data.categories}
      userEmail={viewer?.email ?? null}

      canCreateRootCategory={false}
    />
  );
}
