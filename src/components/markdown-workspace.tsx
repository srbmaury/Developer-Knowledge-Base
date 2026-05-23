"use client";

import { Eye, Pencil } from "lucide-react";
import { MarkdownEditor } from "@/components/markdown-editor";
import { MarkdownPreview } from "@/components/markdown-preview";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type MarkdownViewMode = "editor" | "preview";

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

  return (
    <div className={cn("flex min-h-[min(560px,55vh)] flex-col", className)}>
      <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {effectiveViewMode === "editor" ? "Editor" : "Preview"}
        </span>
        <div
          className="flex rounded-md border border-border bg-background p-0.5 shadow-sm"
          role="tablist"
          aria-label="Editor or preview"
        >
          <Button
            type="button"
            size="sm"
            variant={effectiveViewMode === "editor" ? "secondary" : "ghost"}
            className="h-8 gap-1.5 px-3"
            role="tab"
            aria-selected={effectiveViewMode === "editor"}
            onClick={() => onViewModeChange("editor")}
            disabled={readOnly}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            type="button"
            size="sm"
            variant={effectiveViewMode === "preview" ? "secondary" : "ghost"}
            className="h-8 gap-1.5 px-3"
            role="tab"
            aria-selected={effectiveViewMode === "preview"}
            onClick={() => onViewModeChange("preview")}
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </Button>
        </div>
      </div>

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
