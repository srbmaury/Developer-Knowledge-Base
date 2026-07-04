import { revalidateTag } from "next/cache";

export async function unauthorized() {
  return { ok: false as const, message: "You must be signed in." };
}

export function revalidateWorkspace(userId: string) {
  revalidateTag(`workspace:${userId}`);
  revalidateTag("workspace:public");
}
