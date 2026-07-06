"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Category } from "@/types/knowledge";
import { flattenCategoriesWithPath } from "./editor-pane-utils";

export function MoveToCategoryDialog({
  open,
  currentCategoryId,
  categories,
  onSelect,
  onClose
}: {
  open: boolean;
  currentCategoryId: string | undefined;
  categories: Category[];
  onSelect: (categoryId: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const flat = flattenCategoriesWithPath(categories).filter((c) => c.canEdit && c.id !== currentCategoryId);
  const filtered = search.trim()
    ? flat.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.path.toLowerCase().includes(search.toLowerCase()))
    : flat;

  useEffect(() => { if (!open) setSearch(""); }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogTitle className="text-base font-semibold">Move to category</DialogTitle>
        <Input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search categories…"
          className="mb-1"
        />
        <div className="max-h-64 overflow-y-auto space-y-0.5 rounded-md border p-1">
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">No categories found</p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => { onSelect(c.id); onClose(); }}
                className="flex w-full flex-col rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <span className="font-medium">{c.name}</span>
                {c.path ? <span className="text-xs text-muted-foreground">{c.path}</span> : null}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
