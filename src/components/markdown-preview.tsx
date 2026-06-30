"use client";

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { HighlightJsTheme } from "@/components/hljs-theme";
import { isLikelyHtml } from "@/lib/markdown";
import { cn } from "@/lib/utils";

type MarkdownPreviewProps = {
  content: string;
  className?: string;
  fillPane?: boolean;
  embedded?: boolean;
};

export function MarkdownPreview({ content, className, fillPane, embedded }: MarkdownPreviewProps) {
  const legacyHtml = useMemo(() => isLikelyHtml(content), [content]);

  const bodyClass = cn(
    "markdown-preview-body prose prose-sm max-w-none flex-1 prose-pre:bg-transparent prose-pre:p-0 dark:prose-invert",
    fillPane ? "min-h-0 overflow-y-auto p-5" : "min-h-[480px] overflow-auto p-5"
  );

  const shellClass = cn(
    "markdown-preview flex min-h-0 flex-col",
    fillPane ? "h-full flex-1" : "min-h-[480px]",
    className
  );

  // If legacy mode is selected but the content has HTML-encoded brackets,
  // it was stored escaped and dangerouslySetInnerHTML would show raw entities.
  const looksEscapedHtml = content.includes("&lt;") || content.includes("&gt;");

  if (legacyHtml && !looksEscapedHtml) {
    return (
      <div className={shellClass}>
        <HighlightJsTheme />
        {!embedded ? (
          <div className="border-b bg-muted/40 px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Preview (legacy HTML)
            </span>
          </div>
        ) : null}
        <div className={bodyClass} dangerouslySetInnerHTML={{ __html: content }} />
      </div>
    );
  }


  return (
    <div className={shellClass}>
      <HighlightJsTheme />
      {!embedded ? (
        <div className="border-b bg-muted/40 px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview</span>
        </div>
      ) : null}
      <div className={bodyClass}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
          {content || "*Nothing to preview yet.*"}
        </ReactMarkdown>
      </div>
    </div>
  );
}
