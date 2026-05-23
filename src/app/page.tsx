import { KnowledgeBaseApp } from "@/components/knowledge-base-app";
import { getWorkspaceData } from "@/server/queries";

export default async function Home() {
  const data = await getWorkspaceData();

  return <KnowledgeBaseApp initialCategories={data.categories} />;
}
