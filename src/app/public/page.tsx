import { KnowledgeBaseApp } from "@/components/knowledge-base-app";
import { getSessionUser } from "@/server/auth";
import { getPublicWorkspaceData } from "@/server/queries";

export default async function PublicPage() {
  const [data, viewer] = await Promise.all([getPublicWorkspaceData(), getSessionUser()]);

  const isAdmin = !!process.env.ADMIN_EMAIL && viewer?.email === process.env.ADMIN_EMAIL;
  return (
    <KnowledgeBaseApp
      initialCategories={data.categories}
      userEmail={viewer?.email ?? null}
      isAdmin={isAdmin}
      canCreateRootCategory={false}
    />
  );
}
