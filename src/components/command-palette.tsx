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
  const flatCategories = flattenCategories(categories);
  const questionById = useMemo(
    () => new Map(allQuestions.map((q) => [q.id, q])),
    [allQuestions]
  );

  const visitCounts = useMemo(() => {
    if (typeof window === "undefined") return {} as Record<string, number>;
    const raw = localStorage.getItem("dk:questionVisitCounts");
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  // re-read each time the palette opens
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

  const searchResults = useMemo(() => {
    if (!query.trim() || !searchIndex) return [];
    const hits = searchIndex.search(query);
    return hits
      .map((h) => questionById.get(h.id))
      .filter((q): q is Question => q !== undefined);
  }, [query, searchIndex, questionById]);

  const displayQuestions = query.trim() ? searchResults : recentQuestions;
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
          <Command.List className="max-h-96 overflow-y-auto p-2">
            <Command.Empty className="px-3 py-8 text-center text-sm text-muted-foreground">
              No matching notes found.
            </Command.Empty>
            <Command.Group
              heading={groupLabel}
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
            >
              {displayQuestions.map((question) => (
                <Command.Item
                  key={question.id}
                  value={question.id}
                  onSelect={() => {
                    selectQuestion(question.id);
                    setCommandOpen(false);
                  }}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm aria-selected:bg-muted"
                >
                  <QuestionIcon question={question} />
                  <span className="min-w-0 flex-1 truncate">{question.title || "Untitled question"}</span>
                  {question.tags.length > 0 ? (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {question.tags.map((t) => t.name).join(", ")}
                    </span>
                  ) : null}
                </Command.Item>
              ))}
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
                    onSelect={() => {
                      selectCategory(category.id);
                      setCommandOpen(false);
                    }}
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
