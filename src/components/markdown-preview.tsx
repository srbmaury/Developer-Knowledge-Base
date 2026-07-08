"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { AlertTriangle, Check, Copy, Loader2 } from "lucide-react";
import { HighlightJsTheme } from "@/components/hljs-theme";
import { isLikelyHtml } from "@/lib/markdown";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { getAllQuestions, useWorkspaceStore } from "@/store/workspace-store";

/** Replace [[Title]] with [Title](wiki:Title) before markdown parsing. */
function preprocessWikiLinks(content: string): string {
  return content.replace(/\[\[([^\]]+)\]\]/g, (_, title: string) => `[${title}](wiki:${encodeURIComponent(title.trim())})`);
}

/**
 * react-markdown v9 strips any URL scheme not in its safe-list (http/https/mailto/tel).
 * We extend it to also pass through our internal wiki: links.
 */
function urlTransform(url: string): string {
  if (url.startsWith("wiki:")) return url;
  const colon = url.indexOf(":");
  if (colon < 0) return url;
  const scheme = url.slice(0, colon).toLowerCase();
  return ["http", "https", "mailto", "tel"].includes(scheme) ? url : "";
}

type MarkdownPreviewProps = {
  content: string;
  className?: string;
  fillPane?: boolean;
  embedded?: boolean;
  readOnly?: boolean;
  /** Content hasn't arrived from the server yet — show a loading state instead of "Nothing to preview yet". */
  loading?: boolean;
  /** Content failed to load — show an error state with a retry action instead of spinning forever. */
  error?: boolean;
  onRetry?: () => void;
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
      mermaid.initialize({ startOnLoad: false, securityLevel: "strict" });
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

function CodeBlock({ children, ...props }: React.ComponentPropsWithoutRef<"pre">) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const text = preRef.current?.textContent ?? "";
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="group relative">
      <pre ref={preRef} {...props}>{children}</pre>
      <button
        type="button"
        onClick={handleCopy}
        className="absolute right-2 top-2 flex items-center gap-1 rounded-md border border-border/50 bg-background/80 px-1.5 py-1 text-[11px] text-muted-foreground opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 hover:text-foreground"
        aria-label="Copy code"
      >
        {copied
          ? <><Check className="h-3 w-3 text-emerald-500" /><span className="text-emerald-500">Copied</span></>
          : <><Copy className="h-3 w-3" /><span>Copy</span></>}
      </button>
    </div>
  );
}

function getCategoryPath(categories: import("@/types/knowledge").Category[], questionId: string, path = ""): string {
  for (const cat of categories) {
    const found = cat.questions.some((q) => q.id === questionId);
    const here = path ? `${path} / ${cat.name}` : cat.name;
    if (found) return here;
    const nested = getCategoryPath(cat.children, questionId, here);
    if (nested) return nested;
  }
  return "";
}

function WikiLink({ href, children }: { href: string; children: React.ReactNode }) {
  const { categories } = useWorkspaceStore();
  const [pickerOpen, setPickerOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const title = decodeURIComponent(href.slice("wiki:".length)).toLowerCase();

  const matches = useMemo(
    () => getAllQuestions(categories).filter((q) => q.title.toLowerCase() === title),
    [categories, title]
  );

  function navigate(id: string) {
    useWorkspaceStore.getState().selectQuestion(id);
    setPickerOpen(false);
  }

  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pickerOpen]);

  if (matches.length === 0) {
    return (
      <span className="cursor-not-allowed rounded border border-dashed border-muted-foreground/40 px-1 py-0.5 text-muted-foreground/60 text-[0.9em]">
        [[{decodeURIComponent(href.slice("wiki:".length))}]]
      </span>
    );
  }

  if (matches.length === 1) {
    return (
      <button
        type="button"
        onClick={() => navigate(matches[0].id)}
        className="inline cursor-pointer rounded bg-primary/10 px-1 py-0.5 text-primary text-[0.9em] hover:bg-primary/20 transition-colors"
      >
        {children}
      </button>
    );
  }

  // Multiple matches — show a picker on click
  return (
    <span ref={ref} className="relative inline">
      <button
        type="button"
        onClick={() => setPickerOpen((o) => !o)}
        className="inline cursor-pointer rounded bg-amber-500/10 px-1 py-0.5 text-amber-600 dark:text-amber-400 text-[0.9em] hover:bg-amber-500/20 transition-colors"
        title={`${matches.length} notes share this title — click to pick`}
      >
        {children} ↕
      </button>
      {pickerOpen ? (
        <span className="absolute left-0 top-full z-50 mt-1 flex min-w-[200px] flex-col rounded-lg border bg-card p-1 shadow-lg">
          <span className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {matches.length} notes match
          </span>
          {matches.map((q) => {
            const catPath = getCategoryPath(categories, q.id);
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => navigate(q.id)}
                className="flex flex-col rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                <span className="font-medium text-foreground">{q.title}</span>
                {catPath ? <span className="text-[11px] text-muted-foreground">{catPath}</span> : null}
              </button>
            );
          })}
        </span>
      ) : null}
    </span>
  );
}

function makeMarkdownComponents() {
  return {
    pre: CodeBlock,
    a({ href, children, ...props }: React.ComponentPropsWithoutRef<"a">) {
      if (href?.startsWith("wiki:")) {
        return <WikiLink href={href}>{children}</WikiLink>;
      }
      return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
    },
    code({ className, children, ...props }: React.ComponentPropsWithoutRef<"code"> & { className?: string }) {
      if (/language-mermaid/.test(className ?? "")) {
        return <MermaidDiagram chart={String(children).trim()} />;
      }
      return <code className={className} {...props}>{children}</code>;
    }
  };
}

const defaultMarkdownComponents = makeMarkdownComponents();

export function MarkdownPreview({ content, className, fillPane, embedded, readOnly = false, loading = false, error = false, onRetry }: MarkdownPreviewProps) {
  const processedContent = useMemo(() => preprocessWikiLinks(content), [content]);
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

  if (error) {
    return (
      <div className={shellClass}>
        <HighlightJsTheme />
        {!embedded ? (
          <div className="border-b bg-muted/40 px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview</span>
          </div>
        ) : null}
        <div className={cn(bodyClass, "flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground")}>
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Couldn&rsquo;t load this content.
          </div>
          {onRetry ? (
            <Button type="button" size="sm" variant="outline" onClick={onRetry}>
              Retry
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={shellClass}>
        <HighlightJsTheme />
        {!embedded ? (
          <div className="border-b bg-muted/40 px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview</span>
          </div>
        ) : null}
        <div className={cn(bodyClass, "flex items-center justify-center gap-2 text-sm text-muted-foreground")}>
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      </div>
    );
  }

  const looksEscapedHtml = content.includes("&lt;") || content.includes("&gt;");

  if (legacyHtml && !looksEscapedHtml && !readOnly) {
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
          rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
          components={defaultMarkdownComponents}
          urlTransform={urlTransform}
        >
          {processedContent || "*Nothing to preview yet.*"}
        </ReactMarkdown>
      </div>
    </div>
  );
}
