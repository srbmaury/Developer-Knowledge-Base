"use client";

import { useCallback, useRef } from "react";
import { applyMarkdownInsert, type MarkdownInsertAction } from "@/lib/markdown-insert";
import { MarkdownToolbar } from "@/components/markdown-toolbar";
import { cn } from "@/lib/utils";

type MarkdownEditorProps = {
  content: string;
  onChange: (value: string) => void;
  language?: string;
  className?: string;
  fillPane?: boolean;
  /** Hides the top label row when used inside MarkdownWorkspace. */
  embedded?: boolean;
};

export function MarkdownEditor({
  content,
  onChange,
  language,
  className,
  fillPane,
  embedded
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const applyFormat = useCallback(
    (action: MarkdownInsertAction) => {
      const el = textareaRef.current;
      if (!el) return;

      const { next, selectionStart, selectionEnd } = applyMarkdownInsert(
        content,
        el.selectionStart,
        el.selectionEnd,
        action,
        language
      );
      onChange(next);

      requestAnimationFrame(() => {
        el.focus();
        el.selectionStart = selectionStart;
        el.selectionEnd = selectionEnd;
      });
    },
    [content, language, onChange]
  );

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Tab") return;

    event.preventDefault();
    const el = event.currentTarget;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = `${content.slice(0, start)}  ${content.slice(end)}`;
    onChange(next);

    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + 2;
    });
  }

  return (
    <div className={cn("flex min-h-0 flex-col", fillPane ? "h-full flex-1" : "min-h-[480px]", className)}>
      {!embedded ? (
        <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Editor</span>
          {language && language !== "none" ? (
            <span className="rounded bg-background px-2 py-0.5 text-[11px] text-muted-foreground">{language}</span>
          ) : null}
        </div>
      ) : null}
      <MarkdownToolbar onAction={applyFormat} />
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        className={cn(
          "markdown-source w-full flex-1 resize-none border-0 px-4 py-4 font-mono text-[13px] leading-6 shadow-none outline-none focus-visible:ring-0",
          fillPane ? "min-h-0 overflow-y-auto" : "min-h-[480px] resize-y"
        )}
        placeholder={"# Approach\n\nWrite raw markdown here.\n\n```typescript\nconst example = true;\n```"}
        aria-label="Markdown source editor"
      />
    </div>
  );
}
