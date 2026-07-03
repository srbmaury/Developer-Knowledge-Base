"use client";

import { useMemo } from "react";
import { Command } from "cmdk";
import { CheckCircle, Clock, FileText, Folder, Search, Star } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { getAllQuestions, useWorkspaceStore } from "@/store/workspace-store";
import type { Category, Question } from "@/types/knowledge";

type FlatCategory = { category: Category; path: string };

function flattenCategories(cats: Category[], parentPath = ""): FlatCategory[] {
  return cats.flatMap((cat) => {
    const path = parentPath ? `${parentPath} / ${cat.name}` : cat.name;
    return [{ category: cat, path: parentPath }, ...flattenCategories(cat.children, path)];
  });
}

function QuestionIcon({ question }: { question: Question }) {
  if (question.status === "SOLVED") return <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />;
  if (question.status === "IN_PROGRESS") return <Clock className="h-4 w-4 shrink-0 text-amber-500" />;
  if (question.isFavorite) return <Star className="h-4 w-4 shrink-0 text-amber-400" />;
  return <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />;
}

/** Extract a snippet of text around the first occurrence of any of the query terms. */
function getSnippet(text: string, query: string, radius = 60): string | null {
  if (!text) return null;
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const lower = text.toLowerCase();
  let bestIdx = -1;
  for (const term of terms) {
    const idx = lower.indexOf(term);
    if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) bestIdx = idx;
  }
  if (bestIdx === -1) return null;
  const start = Math.max(0, bestIdx - radius);
  const end = Math.min(text.length, bestIdx + radius);
  const raw = text.slice(start, end).replace(/\n+/g, " ").trim();
  return (start > 0 ? "…" : "") + raw + (end < text.length ? "…" : "");
}

/** Highlight query terms inside a snippet string. Returns an array of {text, highlight} segments. */
function highlightSnippet(snippet: string, query: string): Array<{ text: string; highlight: boolean }> {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [{ text: snippet, highlight: false }];
  const pattern = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  const parts = snippet.split(pattern);
  const lowerTerms = terms.map((t) => t.toLowerCase());
  return parts.map((part) => ({ text: part, highlight: lowerTerms.includes(part.toLowerCase()) }));
}

function SnippetText({ snippet, query }: { snippet: string; query: string }) {
  const parts = highlightSnippet(snippet, query);
  return (
    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
      {parts.map((p, i) =>
        p.highlight
          ? <mark key={i} className="rounded-sm bg-primary/20 text-foreground not-italic">{p.text}</mark>
          : <span key={i}>{p.text}</span>
      )}
    </p>
  );
}

type MatchedQuestion = {
  question: Question;
  snippetField: "description" | "content" | null;
  snippet: string | null;
};

export function CommandPalette() {
  const {
    categories,
    commandOpen,
    setCommandOpen,
    selectQuestion,
    selectCategory,
    setQuery,
    query,
    searchIndex
  } = useWorkspaceStore();

  const allQuestions = getAllQuestions(categories);
  const flatCategories = useMemo(() => flattenCategories(categories), [categories]);
  const questionById = useMemo(
    () => new Map(allQuestions.map((q) => [q.id, q])),
    [allQuestions]
  );

  const visitCounts = useMemo(() => {
    if (typeof window === "undefined") return {} as Record<string, number>;
    const raw = localStorage.getItem("dk:questionVisitCounts");
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commandOpen]);

  const recentQuestions = useMemo(() =>
    [...allQuestions]
      .sort((a, b) => {
        const score = (q: Question) => (q.isFavorite ? 10000 : 0) + (visitCounts[q.id] ?? 0);
        return score(b) - score(a);
      })
      .slice(0, 10),
  [allQuestions, visitCounts]);

  const searchResults = useMemo((): MatchedQuestion[] => {
    if (!query.trim() || !searchIndex) return [];
    const hits = searchIndex.search(query);
    return hits
      .map((h) => {
        const question = questionById.get(h.id);
        if (!question) return null;
        const matchedFields = Object.keys(h.match);
        const isContentMatch = matchedFields.some((f) => f === "content" || f === "notes");
        const isDescriptionMatch = matchedFields.includes("description");
        let snippet: string | null = null;
        let snippetField: "description" | "content" | null = null;
        if (isContentMatch) {
          const allContent = question.solutions.map((s) => s.content + " " + s.notes).join(" ");
          snippet = getSnippet(allContent, query);
          if (snippet) snippetField = "content";
        }
        if (!snippet && isDescriptionMatch) {
          snippet = getSnippet(question.description, query);
          if (snippet) snippetField = "description";
        }
        return { question, snippet, snippetField };
      })
      .filter((r): r is MatchedQuestion => r !== null);
  }, [query, searchIndex, questionById]);

  const filteredCategories = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return flatCategories.filter(({ category, path }) =>
      category.name.toLowerCase().includes(q) || path.toLowerCase().includes(q)
    );
  }, [query, flatCategories]);

  const groupLabel = query.trim() ? "Results" : "Recent";

  return (
    <Dialog open={commandOpen} onOpenChange={setCommandOpen}>
      <DialogContent className="overflow-hidden p-0">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <Command className="bg-card" shouldFilter={!query.trim()}>
          <div className="flex items-center gap-2 border-b px-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search titles, content, notes, tags…"
              className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Command.List className="max-h-[28rem] overflow-y-auto p-2">
            <Command.Empty className="px-3 py-8 text-center text-sm text-muted-foreground">
              No matching notes found.
            </Command.Empty>
            <Command.Group
              heading={groupLabel}
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
            >
              {query.trim()
                ? searchResults.map(({ question, snippet, snippetField }) => (
                    <Command.Item
                      key={question.id}
                      value={question.id}
                      onSelect={() => { selectQuestion(question.id); setCommandOpen(false); }}
                      className="flex cursor-pointer flex-col gap-0.5 rounded-md px-3 py-2 text-sm aria-selected:bg-muted"
                    >
                      <div className="flex items-center gap-3">
                        <QuestionIcon question={question} />
                        <span className="min-w-0 flex-1 truncate font-medium">{question.title || "Untitled question"}</span>
                        {snippetField === "content" ? (
                          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">content</span>
                        ) : question.tags.length > 0 ? (
                          <span className="shrink-0 text-xs text-muted-foreground">{question.tags.map((t) => t.name).join(", ")}</span>
                        ) : null}
                      </div>
                      {snippet ? <SnippetText snippet={snippet} query={query} /> : null}
                    </Command.Item>
                  ))
                : recentQuestions.map((question) => (
                    <Command.Item
                      key={question.id}
                      value={question.id}
                      onSelect={() => { selectQuestion(question.id); setCommandOpen(false); }}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm aria-selected:bg-muted"
                    >
                      <QuestionIcon question={question} />
                      <span className="min-w-0 flex-1 truncate">{question.title || "Untitled question"}</span>
                      {question.tags.length > 0 ? (
                        <span className="shrink-0 text-xs text-muted-foreground">{question.tags.map((t) => t.name).join(", ")}</span>
                      ) : null}
                    </Command.Item>
                  ))
              }
            </Command.Group>
            {!query.trim() ? (
              <Command.Group
                heading="Categories"
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {flatCategories.map(({ category, path }) => (
                  <Command.Item
                    key={category.id}
                    value={`cat:${category.id}:${category.name} ${path}`}
                    onSelect={() => { selectCategory(category.id); setCommandOpen(false); }}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm aria-selected:bg-muted"
                  >
                    <Folder className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{category.name}</span>
                    {path ? <span className="shrink-0 text-xs text-muted-foreground">{path}</span> : null}
                  </Command.Item>
                ))}
              </Command.Group>
            ) : filteredCategories.length > 0 ? (
              <Command.Group
                heading="Categories"
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {filteredCategories.map(({ category, path }) => (
                  <Command.Item
                    key={`cat-search-${category.id}`}
                    value={`cat:${category.id}:${category.name} ${path}`}
                    onSelect={() => { selectCategory(category.id); setCommandOpen(false); }}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm aria-selected:bg-muted"
                  >
                    <Folder className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{category.name}</span>
                    {path ? <span className="shrink-0 text-xs text-muted-foreground">{path}</span> : null}
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
