"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Question } from "@/types/knowledge";

export const SORT_OPTIONS = [
  { value: "default", label: "Default" },
  { value: "title-asc", label: "Title A–Z" },
  { value: "title-desc", label: "Title Z–A" },
  { value: "newest", label: "Recently updated" },
  { value: "oldest", label: "Oldest first" },
] as const;
export type SortOption = typeof SORT_OPTIONS[number]["value"];

export function sortWithinGroup(qs: Question[], sort: SortOption): Question[] {
  if (sort === "default") return qs;
  const sorted = [...qs];
  switch (sort) {
    case "title-asc": return sorted.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    case "title-desc": return sorted.sort((a, b) => (b.title || "").localeCompare(a.title || ""));
    case "newest": return sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    case "oldest": return sorted.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
  }
}

export function SortDropdown({ sort, onChange }: { sort: SortOption; onChange: (s: SortOption) => void }) {
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

  const active = sort !== "default";
  const activeLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all",
          active
            ? "bg-primary/10 text-primary ring-2 ring-primary ring-offset-1"
            : "bg-muted text-muted-foreground hover:text-foreground"
        )}
      >
        <ArrowUpDown className="h-3 w-3" />
        {active ? activeLabel : "Sort"}
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-44 rounded-lg border bg-card p-1 shadow-lg">
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => { onChange(option.value); setOpen(false); }}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                sort === option.value ? "bg-primary/10 text-primary" : "hover:bg-muted"
              )}
            >
              <span className="flex-1 text-left font-medium">{option.label}</span>
              {sort === option.value ? <span className="text-[10px] font-bold">✓</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
