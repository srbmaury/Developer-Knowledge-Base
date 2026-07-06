"use client";

import { useState } from "react";
import Link from "next/link";
import { Flag, LogOut, ShieldCheck, User } from "lucide-react";
import { signOutAction } from "@/app/auth/actions";
import { reportIssueAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { toast } from "sonner";

type UserMenuProps = {
  email: string | null;
  isAdmin?: boolean;
};

function ReportIssueDialog({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await reportIssueAction({ title, description });
      if (!result.ok) {
        toast.error("message" in result ? result.message : "Failed to submit.");
        setSubmitting(false);
        return;
      }
      toast.success("Issue reported. Thank you!");
      onClose();
    } catch {
      toast.error("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 pt-1">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">Title</label>
        <input
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Brief summary of the issue"
          className="rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">Description</label>
        <textarea
          required
          maxLength={5000}
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Steps to reproduce, what you expected, what happened…"
          className="resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={submitting} className="flex-1">
          {submitting ? "Submitting…" : "Submit"}
        </Button>
        <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function UserMenu({ email, isAdmin = false }: UserMenuProps) {
  const [reportOpen, setReportOpen] = useState(false);

  if (!email) {
    return (
      <Button className="w-full justify-start gap-2" variant="ghost" asChild>
        <Link href="/login">
          <User className="h-4 w-4 shrink-0" />
          Sign in
        </Link>
      </Button>
    );
  }

  if (reportOpen) {
    return (
      <Dialog open onOpenChange={(open) => { if (!open) setReportOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Report an issue</DialogTitle>
          <DialogDescription>Describe what went wrong and we&apos;ll look into it.</DialogDescription>
          <ReportIssueDialog onClose={() => setReportOpen(false)} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="w-full justify-start gap-2" variant="ghost">
          <User className="h-4 w-4 shrink-0" />
          <span className="truncate text-left text-sm">{email}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogTitle>Account</DialogTitle>
        <DialogDescription>Signed in as {email}</DialogDescription>
        <p className="text-sm text-muted-foreground">
          Your categories, questions, and approaches are private to this account.
        </p>
        <div className="flex flex-col gap-2">
          {isAdmin && (
            <Button variant="outline" className="w-full gap-2" asChild>
              <Link href="/admin">
                <ShieldCheck className="h-4 w-4" />
                Admin panel
              </Link>
            </Button>
          )}
          <Button variant="outline" className="w-full gap-2" asChild>
            <Link href="/account">
              <User className="h-4 w-4" />
              Account settings
            </Link>
          </Button>
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => setReportOpen(true)}
          >
            <Flag className="h-4 w-4" />
            Report an issue
          </Button>
          <form action={signOutAction}>
            <Button type="submit" variant="outline" className="w-full gap-2">
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
