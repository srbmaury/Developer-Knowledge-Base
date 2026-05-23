"use client";

import { useEffect, useMemo, useState } from "react";
import { useHotkeys } from "@/components/use-hotkeys";
import { CommandPalette } from "@/components/command-palette";
import { EditorPane } from "@/components/editor-pane";
import { QuestionList } from "@/components/question-list";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { Category } from "@/types/knowledge";
import { ListCollapse, PanelLeftOpen, PanelRightClose, PanelRightOpen, Plus, Search } from "lucide-react";

export function KnowledgeBaseApp({ initialCategories }: { initialCategories: Category[] }) {
  const { categories, setInitialData, setCommandOpen, selectedCategoryId, addQuestion } = useWorkspaceStore();
  const [categoriesOpen, setCategoriesOpen] = useState(true);
  const [questionsOpen, setQuestionsOpen] = useState(true);

  useEffect(() => {
    setInitialData(initialCategories);
  }, [initialCategories, setInitialData]);

  useHotkeys("ctrl+k", () => setCommandOpen(true));
  useHotkeys("meta+k", () => setCommandOpen(true));

  const selectedCategoryName = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId)?.name ?? "All Notes",
    [categories, selectedCategoryId]
  );

  return (
    <TooltipProvider>
      <main className="flex h-screen overflow-hidden bg-background/85 text-foreground">
        {categoriesOpen ? <Sidebar onCollapse={() => setCategoriesOpen(false)} /> : null}
        {questionsOpen ? (
          <section className="hidden h-full w-80 shrink-0 overflow-hidden border-r bg-background/70 lg:flex lg:flex-col">
            <QuestionList onCollapse={() => setQuestionsOpen(false)} />
          </section>
        ) : null}
        <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur-xl sm:px-5">
            <Button
              variant="ghost"
              size="icon"
              className="hidden md:inline-flex"
              onClick={() => setCategoriesOpen((open) => !open)}
              aria-label={categoriesOpen ? "Collapse categories sidebar" : "Expand categories sidebar"}
            >
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:inline-flex"
              onClick={() => setQuestionsOpen((open) => !open)}
              aria-label={questionsOpen ? "Collapse questions sidebar" : "Expand questions sidebar"}
            >
              {questionsOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Questions">
              <ListCollapse className="h-4 w-4" />
            </Button>
            <button
              onClick={() => setCommandOpen(true)}
              className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border bg-card px-3 text-left text-sm text-muted-foreground shadow-sm transition-colors hover:bg-muted"
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="truncate">Search questions, snippets, categories...</span>
              <kbd className="ml-auto hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] sm:inline">Ctrl K</kbd>
            </button>
            <Button
              variant="secondary"
              className="hidden sm:inline-flex"
              onClick={() => selectedCategoryId && void addQuestion(selectedCategoryId, "")}
            >
              <Plus className="h-4 w-4" />
              Quick add
            </Button>
          </header>
          <div className="grid min-h-0 shrink-0 grid-cols-1 lg:hidden">
            <div className="max-h-72 overflow-hidden border-b bg-background/70 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{selectedCategoryName}</p>
              <QuestionList compact />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
            <EditorPane />
          </div>
        </section>
        <CommandPalette />
        <Button
          className="fixed bottom-5 right-5 z-40 h-12 w-12 rounded-full shadow-soft sm:hidden"
          size="icon"
          onClick={() => selectedCategoryId && void addQuestion(selectedCategoryId, "")}
          aria-label="Quick add question"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </main>
    </TooltipProvider>
  );
}
