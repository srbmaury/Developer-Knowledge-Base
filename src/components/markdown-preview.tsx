"use client";

import { useEffect, useId, useRef, useState } from "react";
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

function MermaidDiagram({ chart }: { chart: string }) {
  const rawId = useId();
  const safeId = `mermaid${rawId.replace(/:/g, "")}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    setError(null);

    import("mermaid").then(({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, securityLevel: "loose" });
      return mermaid.render(safeId, chart);
    }).then(({ svg }) => {
      if (containerRef.current) containerRef.current.innerHTML = svg;
    }).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Invalid diagram");
    });
  }, [chart, safeId]);

  if (error) {
    return (
      <div className="rounded border border-destructive/20 bg-destructive/5 p-3 font-mono text-xs text-destructive">
        Mermaid error: {error}
      </div>
    );
  }

  return <div ref={containerRef} className="my-2 flex justify-center overflow-x-auto" />;
}

const markdownComponents = {
  code({ className, children, ...props }: React.ComponentPropsWithoutRef<"code"> & { className?: string }) {
    if (/language-mermaid/.test(className ?? "")) {
      return <MermaidDiagram chart={String(children).trim()} />;
    }
    return <code className={className} {...props}>{children}</code>;
  }
};

export function MarkdownPreview({ content, className, fillPane, embedded }: MarkdownPreviewProps) {
  const legacyHtml = isLikelyHtml(content);

  const bodyClass = cn(
    "markdown-preview-body prose prose-sm max-w-none flex-1 prose-pre:bg-transparent prose-pre:p-0 dark:prose-invert",
    fillPane ? "min-h-0 overflow-y-auto p-5" : "min-h-[480px] overflow-auto p-5"
  );

  const shellClass = cn(
    "markdown-preview flex min-h-0 flex-col",
    fillPane ? "h-full flex-1" : "min-h-[480px]",
    className
  );

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
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={markdownComponents}
        >
          {content || "*Nothing to preview yet.*"}
        </ReactMarkdown>
      </div>
    </div>
  );
}
