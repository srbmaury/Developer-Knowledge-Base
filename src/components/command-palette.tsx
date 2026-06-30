"use client";

import { Command } from "cmdk";
import { FileText, Folder, Search, Star } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { getAllQuestions, useWorkspaceStore } from "@/store/workspace-store";
import type { Category } from "@/types/knowledge";

type FlatCategory = { category: Category; path: string };

function flattenCategories(cats: Category[], parentPath = ""): FlatCategory[] {
  return cats.flatMap((cat) => {
    const path = parentPath ? `${parentPath} / ${cat.name}` : cat.name;
    return [{ category: cat, path: parentPath }, ...flattenCategories(cat.children, path)];
  });
}

export function CommandPalette() {
  const {
    categories,
    commandOpen,
    setCommandOpen,
    selectQuestion,
    selectCategory,
    setQuery,
    query
  } = useWorkspaceStore();
  const questions = getAllQuestions(categories);
  const flatCategories = flattenCategories(categories);

  return (
    <Dialog open={commandOpen} onOpenChange={setCommandOpen}>
      <DialogContent className="overflow-hidden p-0">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <Command className="bg-card">
          <div className="flex items-center gap-2 border-b px-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Command.Input
              value={query}
              onValueChange={(value) => {
                setQuery(value);
              }}
              placeholder="Search or jump to..."
              className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Command.List className="max-h-96 overflow-y-auto p-2">
            <Command.Empty className="px-3 py-8 text-center text-sm text-muted-foreground">No matching notes found.</Command.Empty>
            <Command.Group heading="Questions" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
              {questions.map((question) => (
                <Command.Item
                  key={question.id}
                  value={`${question.title} ${question.description}`}
                  onSelect={() => {
                    selectQuestion(question.id);
                    setCommandOpen(false);
                  }}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm aria-selected:bg-muted"
                >
                  {question.isFavorite ? <Star className="h-4 w-4 shrink-0 text-amber-400" /> : <FileText className="h-4 w-4 shrink-0" />}
                  <span className="min-w-0 flex-1 truncate">{question.title || "Untitled question"}</span>
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Group heading="Categories" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
              {flatCategories.map(({ category, path }) => (
                <Command.Item
                  key={category.id}
                  value={`${category.name} ${path}`}
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
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
