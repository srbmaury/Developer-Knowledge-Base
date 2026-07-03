"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Columns2, Eye, Link2, Pencil } from "lucide-react";
import { MarkdownEditor } from "@/components/markdown-editor";
import { MarkdownPreview } from "@/components/markdown-preview";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type MarkdownViewMode = "editor" | "preview" | "split";

type MarkdownWorkspaceProps = {
  content: string;
  onChange: (value: string) => void;
  language?: string;
  viewMode: MarkdownViewMode;
  onViewModeChange: (mode: MarkdownViewMode) => void;
  className?: string;
  readOnly?: boolean;
};

export function MarkdownWorkspace({
  content,
  onChange,
  language,
  viewMode,
  onViewModeChange,
  className,
  readOnly = false
}: MarkdownWorkspaceProps) {
  const effectiveViewMode = readOnly && viewMode === "editor" ? "preview" : viewMode;

  const containerRef = useRef<HTMLDivElement>(null);
  const [splitPercent, setSplitPercent] = useState(50);
  const dragging = useRef(false);

  const handleDividerMouseDown = useCallback(() => {
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    if (effectiveViewMode !== "split") return;

    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = Math.min(80, Math.max(20, ((e.clientX - rect.left) / rect.width) * 100));
      setSplitPercent(pct);
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [effectiveViewMode]);

  const { wordCount, readMin } = useMemo(() => {
    const words = content.trim() ? content.trim().split(/\s+/).filter(Boolean).length : 0;
    return { wordCount: words, readMin: Math.max(1, Math.ceil(words / 200)) };
  }, [content]);

  const toolbar = (
    <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {effectiveViewMode === "editor" ? "Editor" : effectiveViewMode === "split" ? "Split view" : "Preview"}
        </span>
        {wordCount > 0 && (
          <span className="hidden text-[10px] text-muted-foreground/60 sm:inline">
            {wordCount} words · {readMin} min read
          </span>
        )}
        <span
          className="group relative hidden cursor-default items-center gap-1 rounded border border-dashed border-muted-foreground/30 px-1.5 py-0.5 text-[10px] text-muted-foreground/50 sm:flex"
          title="Type [[Note Title]] to link to another note"
        >
          <Link2 className="h-2.5 w-2.5" />
          [[wiki link]]
          <span className="pointer-events-none absolute bottom-full left-0 mb-1 hidden w-max rounded-md border bg-card px-2 py-1 text-xs text-foreground shadow-md group-hover:block">
            Type [[Note Title]] to link to another note
          </span>
        </span>
      </div>
      <div
        className="flex rounded-md border border-border bg-background p-0.5 shadow-sm"
        role="tablist"
        aria-label="Editor view mode"
      >
        <Button
          type="button" size="sm"
          variant={effectiveViewMode === "editor" ? "secondary" : "ghost"}
          className="h-8 gap-1.5 px-3"
          role="tab" aria-selected={effectiveViewMode === "editor"}
          onClick={() => onViewModeChange("editor")}
          disabled={readOnly}
          title="Edit only"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
        <Button
          type="button" size="sm"
          variant={effectiveViewMode === "split" ? "secondary" : "ghost"}
          className="h-8 gap-1.5 px-3"
          role="tab" aria-selected={effectiveViewMode === "split"}
          onClick={() => onViewModeChange("split")}
          disabled={readOnly}
          title="Split view"
        >
          <Columns2 className="h-3.5 w-3.5" />
          Split
        </Button>
        <Button
          type="button" size="sm"
          variant={effectiveViewMode === "preview" ? "secondary" : "ghost"}
          className="h-8 gap-1.5 px-3"
          role="tab" aria-selected={effectiveViewMode === "preview"}
          onClick={() => onViewModeChange("preview")}
          title="Preview only"
        >
          <Eye className="h-3.5 w-3.5" />
          Preview
        </Button>
      </div>
    </div>
  );

  if (effectiveViewMode === "split") {
    return (
      <div className={cn("flex min-h-[min(560px,55vh)] flex-col", className)}>
        {toolbar}
        <div ref={containerRef} className="flex min-h-0 flex-1">
          <div className="min-h-0 overflow-hidden" style={{ width: `${splitPercent}%` }}>
            <MarkdownEditor
              content={content}
              onChange={onChange}
              language={language}
              fillPane
              embedded
              readOnly={readOnly}
              className="h-full"
            />
          </div>
          <div
            className="w-1 shrink-0 cursor-col-resize bg-border hover:bg-primary/30 transition-colors"
            onMouseDown={handleDividerMouseDown}
          />
          <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
            <MarkdownPreview content={content} fillPane embedded className="h-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-[min(560px,55vh)] flex-col", className)}>
      {toolbar}
      {effectiveViewMode === "editor" ? (
        <MarkdownEditor
          content={content}
          onChange={onChange}
          language={language}
          fillPane
          embedded
          readOnly={readOnly}
          className="min-h-0 flex-1"
        />
      ) : (
        <MarkdownPreview content={content} fillPane embedded className="min-h-0 flex-1" />
      )}
    </div>
  );
}
