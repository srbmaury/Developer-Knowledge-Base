"use client";

import { useEffect, useRef, useState } from "react";
import { Filter, X } from "lucide-react";
import { TAG_DOT_CLASSES } from "@/lib/tag-colors";
import { cn } from "@/lib/utils";
import type { Tag } from "@/types/knowledge";

export function TagFilterDropdown({
  allTags,
  filterTagIds,
  toggleTagFilter,
  clearTagFilter
}: {
  allTags: Tag[];
  filterTagIds: string[];
  toggleTagFilter: (id: string) => void;
  clearTagFilter: () => void;
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

  if (allTags.length === 0) return null;
  const activeCount = filterTagIds.length;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all",
          activeCount > 0
            ? "bg-primary/10 text-primary ring-2 ring-primary ring-offset-1"
            : "bg-muted text-muted-foreground hover:text-foreground"
        )}
      >
        <Filter className="h-3 w-3" />
        Tags
        {activeCount > 0 ? (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
            {activeCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-48 rounded-lg border bg-card p-1 shadow-lg">
          {allTags.map((tag) => {
            const active = filterTagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                onClick={() => toggleTagFilter(tag.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                  active ? "bg-primary/10 text-primary" : "hover:bg-muted"
                )}
              >
                <span className={cn("h-2 w-2 shrink-0 rounded-full", TAG_DOT_CLASSES[tag.color])} />
                <span className="flex-1 text-left font-medium">{tag.name}</span>
                {active ? <span className="text-[10px] font-bold">✓</span> : null}
              </button>
            );
          })}
          {activeCount > 0 ? (
            <div className="mt-1 border-t pt-1">
              <button
                onClick={() => { clearTagFilter(); setOpen(false); }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3 w-3" /> Clear tag filters
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
