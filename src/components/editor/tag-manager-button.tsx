"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { TAG_COLORS, TAG_DOT_CLASSES } from "@/lib/tag-colors";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Tag, TagColor } from "@/types/knowledge";

export function TagManagerButton({
  questionId,
  questionTags,
  allTags,
  onCreate,
  onAdd
}: {
  questionId: string;
  questionTags: Tag[];
  allTags: Tag[];
  onCreate: (name: string, color: TagColor) => Promise<Tag | null>;
  onAdd: (questionId: string, tagId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<TagColor>("blue");
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const assignedIds = new Set(questionTags.map((t) => t.id));
  const available = allTags.filter(
    (t) => !assignedIds.has(t.id) && t.name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    const tag = await onCreate(newName.trim(), newColor);
    if (tag) {
      onAdd(questionId, tag.id);
      setNewName("");
      setNewColor("blue");
      setOpen(false);
    }
    setCreating(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-10 items-center gap-1 rounded-full border border-dashed px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground sm:min-h-0 sm:px-2.5 sm:py-0.5"
      >
        <Plus className="h-3 w-3" /> Tag
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border bg-card p-2 shadow-lg">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tags…"
            className="mb-2 h-7 text-xs"
            autoFocus
          />
          {available.length > 0 ? (
            <div className="mb-2 max-h-40 space-y-0.5 overflow-y-auto">
              {available.map((tag) => (
                <button
                  key={tag.id}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted"
                  onClick={() => {
                    onAdd(questionId, tag.id);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", TAG_DOT_CLASSES[tag.color])} />
                  {tag.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="mb-2 px-2 text-xs text-muted-foreground">
              {search ? "No matching tags" : assignedIds.size === allTags.length ? "All tags applied" : null}
            </p>
          )}
          <div className="border-t pt-2">
            <p className="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">New tag</p>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Tag name"
              className="mb-2 h-7 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreate();
              }}
            />
            <div className="mb-2 flex flex-wrap gap-1.5 px-1">
              {TAG_COLORS.map((color) => (
                <button
                  key={color}
                  className={cn(
                    "h-4 w-4 rounded-full transition-transform hover:scale-110",
                    TAG_DOT_CLASSES[color],
                    newColor === color && "ring-2 ring-primary ring-offset-1"
                  )}
                  onClick={() => setNewColor(color)}
                  title={color}
                />
              ))}
            </div>
            <Button
              size="sm"
              className="h-7 w-full text-xs"
              disabled={!newName.trim() || creating}
              onClick={() => void handleCreate()}
            >
              {creating ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              Create & add
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
