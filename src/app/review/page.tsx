import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth";
import { getWorkspaceData } from "@/server/queries";
import { ReviewQueue } from "@/components/review-queue";

export default async function ReviewPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const data = await getWorkspaceData();
  const isAdmin = !!process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL;
  return <ReviewQueue initialCategories={data.categories} userEmail={user.email} isAdmin={isAdmin} />;
}
