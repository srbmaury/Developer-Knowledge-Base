"use client";

import { useEffect, useRef, useState } from "react";
import { Brain, Download, FolderInput, MoreHorizontal, Pin, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Question } from "@/types/knowledge";

export function QuestionActionsMenu({ question, canEdit, onExport, onMove, onPin, onStar, onReview }: {
  question: Question;
  canEdit: boolean;
  onExport: () => void;
  onMove: () => void;
  onPin: () => void;
  onStar: () => void;
  onReview: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function action(fn: () => void) { fn(); setOpen(false); }

  const items = [
    { label: "Export to Markdown", icon: Download, onClick: () => action(onExport), always: true },
    { label: canEdit ? (question.isPinned ? "Unpin" : "Pin") : null, icon: Pin, onClick: () => action(onPin), active: question.isPinned, activeClass: "text-accent", always: false },
    { label: canEdit ? (question.isFavorite ? "Remove from favourites" : "Add to favourites") : null, icon: Star, onClick: () => action(onStar), active: question.isFavorite, activeClass: "text-amber-500", always: false },
    { label: canEdit ? (question.srDue ? "Remove from review queue" : "Add to review queue") : null, icon: Brain, onClick: () => action(onReview), active: !!question.srDue, activeClass: "text-primary", always: false },
    { label: canEdit ? "Move to category" : null, icon: FolderInput, onClick: () => action(onMove), always: false },
  ].filter((i) => i.always || (canEdit && i.label));

  return (
    <div ref={ref} className="relative">
      <Button variant="outline" size="icon" onClick={() => setOpen((o) => !o)} aria-label="More actions" title="More actions">
        <MoreHorizontal className="h-4 w-4" />
      </Button>
      {open ? (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-52 rounded-lg border bg-card p-1 shadow-lg">
          {items.map((item) => item.label ? (
            <button key={item.label} onClick={item.onClick}
              className={cn("flex w-full items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted", item.active && item.activeClass)}>
              <item.icon className={cn("h-4 w-4 shrink-0", item.active && item.activeClass)} />
              {item.label}
            </button>
          ) : null)}
        </div>
      ) : null}
    </div>
  );
}
