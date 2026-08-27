"use client";

import { useEffect, useRef, useState } from "react";
import { Inbox, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getAllQuestions, useWorkspaceStore } from "@/store/workspace-store";
import type { Category } from "@/types/knowledge";

function findInboxCategory(categories: Category[]): Category | null {
  for (const cat of categories) {
    if (cat.name.toLowerCase() === "inbox") return cat;
    const nested = findInboxCategory(cat.children);
    if (nested) return nested;
  }
  return null;
}

export function QuickCaptureModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { categories, addCategory, addQuestion } = useWorkspaceStore();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTitle("");
      setContent("");
      requestAnimationFrame(() => titleRef.current?.focus());
    }
  }, [open]);

  const inboxCategory = findInboxCategory(categories);
  const inboxCount = inboxCategory ? getAllQuestions([inboxCategory]).length : 0;

  async function handleSave() {
    const t = title.trim();
    if (!t) return;
    setSaving(true);
    try {
      let inboxId = inboxCategory?.id ?? null;
      if (!inboxId) {
        await addCategory("Inbox");
        const updatedCategories = useWorkspaceStore.getState().categories;
        const found = findInboxCategory(updatedCategories);
        inboxId = found?.id ?? null;
      }
      if (!inboxId) return;

      await addQuestion(inboxId, t);

      if (content.trim()) {
        const state = useWorkspaceStore.getState();
        const solutionId = state.selectedSolutionId;
        if (solutionId && !solutionId.startsWith("temp-")) {
          state.updateSolutionContent(solutionId, content.trim());
        }
      }

      onClose();
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void handleSave();
    if (e.key === "Escape") onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">Quick capture</DialogTitle>
        <DialogDescription className="sr-only">Create a note in the Inbox without leaving the current view.</DialogDescription>
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3 pr-10">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Inbox className="h-4 w-4 text-primary" />
            Quick capture
          </div>
          <span className="text-xs text-muted-foreground">
            → Inbox {inboxCount > 0 ? `(${inboxCount})` : ""}
          </span>
        </div>

        <div className="p-4 space-y-3">
          <input
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Note title…"
            className="w-full bg-transparent text-base font-medium placeholder:text-muted-foreground/60 outline-none"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Content (optional)…"
            rows={4}
            className="w-full resize-none bg-transparent font-mono text-sm text-muted-foreground placeholder:text-muted-foreground/40 outline-none"
          />
        </div>

        <div className="flex items-center justify-between border-t px-4 py-3">
          <span className="text-xs text-muted-foreground">
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">⌘↵</kbd> to save
          </span>
          <Button
            size="sm"
            onClick={() => void handleSave()}
            disabled={saving || !title.trim()}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Capture
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
