"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { deleteAccountAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function AccountPage() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirming) { setConfirming(true); return; }
    setDeleting(true);
    try {
      const result = await deleteAccountAction();
      if (!result.ok) {
        toast.error("message" in result ? result.message : "Failed to delete account.");
        setDeleting(false);
        setConfirming(false);
        return;
      }
      toast.success("Account deleted.");
      router.push("/login");
    } catch {
      toast.error("Something went wrong. Please try again.");
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <h1 className="mb-8 text-2xl font-semibold">Account</h1>

      <section className="rounded-lg border border-destructive/30 p-6">
        <div className="mb-3 flex items-center gap-2">
          <Trash2 className="h-4 w-4 text-destructive" />
          <h2 className="font-semibold text-destructive">Delete Account</h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Permanently deletes your account and all associated data — categories, questions,
          solutions, and tags. This action cannot be undone.
        </p>
        {confirming && (
          <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
            Are you sure? This will permanently delete everything and sign you out.
          </p>
        )}
        <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
          {deleting ? "Deleting…" : confirming ? "Yes, delete my account" : "Delete my account"}
        </Button>
        {confirming && !deleting && (
          <button
            onClick={() => setConfirming(false)}
            className="ml-3 text-sm text-muted-foreground underline"
          >
            Cancel
          </button>
        )}
      </section>

      <p className="mt-10 text-xs text-muted-foreground">
        <Link href="/terms" className="underline">Terms of Service</Link>
        {" · "}
        <Link href="/privacy" className="underline">Privacy Policy</Link>
        {" · "}
        <Link href="/" className="underline">Back to app</Link>
      </p>
    </div>
  );
}
