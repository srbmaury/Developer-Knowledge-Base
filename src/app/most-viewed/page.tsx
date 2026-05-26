import { MostViewedClient } from "@/components/most-viewed-client";
import { getWorkspaceData } from "@/server/queries";

export default async function MostViewedPage() {
  const data = await getWorkspaceData();

  return <MostViewedClient initialCategories={data.categories} userEmail={null} />;
}


