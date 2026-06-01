"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useHotkeys } from "@/components/use-hotkeys";
import { CommandPalette } from "@/components/command-palette";
import { EditorPane } from "@/components/editor-pane";
import { QuestionList } from "@/components/question-list";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getCategoryById, useWorkspaceStore } from "@/store/workspace-store";
import type { Category } from "@/types/knowledge";
import { ListCollapse, Loader2, PanelLeftOpen, PanelRightClose, PanelRightOpen, Plus, Search } from "lucide-react";

export function KnowledgeBaseApp({
  initialCategories,
  userEmail,
  workspaceTitle = "Developer Knowledge Base",
  workspaceSubtitle = "Your private workspace",
  canCreateRootCategory = true
}: {
  initialCategories: Category[];
  userEmail: string | null;
  workspaceTitle?: string;
  workspaceSubtitle?: string;
  canCreateRootCategory?: boolean;
}) {
  const {
    categories,
    setInitialData,
    setCommandOpen,
    selectedCategoryId,
    addQuestion,
    creatingQuestionCategoryIds
  } = useWorkspaceStore();
  const [categoriesOpen, setCategoriesOpen] = useState(true);
  const [questionsOpen, setQuestionsOpen] = useState(true);
  const [categoriesWidth, setCategoriesWidth] = useState(288); // w-72 = 18rem = 288px
  const [questionsWidth, setQuestionsWidth] = useState(320); // w-80 = 20rem = 320px
  const [resizing, setResizing] = useState<"categories" | "questions" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInitialData(initialCategories);
  }, [initialCategories, setInitialData]);

  useHotkeys("ctrl+k", () => setCommandOpen(true));
  useHotkeys("meta+k", () => setCommandOpen(true));

  const selectedCategoryName = useMemo(
    () => getCategoryById(categories, selectedCategoryId)?.name ?? "All Notes",
    [categories, selectedCategoryId]
  );
  const selectedCategory = getCategoryById(categories, selectedCategoryId);
  const canEditSelectedCategory = selectedCategory?.canEdit ?? false;
  const isCreatingQuestion = Boolean(
    selectedCategoryId && creatingQuestionCategoryIds.includes(selectedCategoryId)
  );

  useEffect(() => {
    if (!selectedCategoryId) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("q") !== selectedCategoryId) {
      url.searchParams.set("q", selectedCategoryId);
      window.history.replaceState({}, "", url.toString());
    }
  }, [selectedCategoryId]);

  // Handle resize logic for sidebars
  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const newX = e.clientX - rect.left;

      if (resizing === "categories") {
        // Constrain categories width between 200px and 500px
        setCategoriesWidth(Math.max(200, Math.min(500, newX)));
      } else if (resizing === "questions") {
        // Calculate position relative to categories sidebar + resize handle
        const questionsStart = categoriesOpen ? categoriesWidth + 4 : 0;
        const relativeX = newX - questionsStart;
        // Constrain questions width between 200px and 500px
        setQuestionsWidth(Math.max(200, Math.min(500, relativeX)));
      }
    };

    const handleMouseUp = () => {
      setResizing(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizing, categoriesOpen, categoriesWidth]);

  return (
    <TooltipProvider>
      <main ref={containerRef} className="flex h-screen overflow-hidden bg-background/85 text-foreground">
        {categoriesOpen ? (
          <>
            <div className="hidden h-full shrink-0 overflow-hidden md:flex" style={{ width: `${categoriesWidth}px` }}>
              <Sidebar
                userEmail={userEmail}
                workspaceTitle={workspaceTitle}
                workspaceSubtitle={workspaceSubtitle}
                canCreateRootCategory={canCreateRootCategory}
                onCollapse={() => setCategoriesOpen(false)}
              />
            </div>
            <div
              className="hidden h-full w-1 cursor-col-resize select-none bg-transparent hover:bg-primary/20 md:block"
              onMouseDown={() => setResizing("categories")}
              title="Drag to resize categories"
            />
          </>
        ) : null}
        {questionsOpen ? (
          <>
            <section className="hidden h-full min-w-0 shrink-0 overflow-hidden border-r bg-background/70 lg:flex lg:flex-col" style={{ width: `${questionsWidth}px` }}>
              <QuestionList onCollapse={() => setQuestionsOpen(false)} />
            </section>
            <div
              className="hidden h-full w-1 cursor-col-resize select-none bg-transparent hover:bg-primary/20 lg:block"
              onMouseDown={() => setResizing("questions")}
              title="Drag to resize questions"
            />
          </>
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
            {canEditSelectedCategory ? (
              <Button
                variant="secondary"
                className="hidden sm:inline-flex"
                disabled={isCreatingQuestion}
                onClick={() => selectedCategoryId && void addQuestion(selectedCategoryId, "")}
              >
                {isCreatingQuestion ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {isCreatingQuestion ? "Adding" : "Quick add"}
              </Button>
            ) : null}
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
        {canEditSelectedCategory ? (
          <Button
            className="fixed bottom-5 right-5 z-40 h-12 w-12 rounded-full shadow-soft sm:hidden"
            size="icon"
            disabled={isCreatingQuestion}
            onClick={() => selectedCategoryId && void addQuestion(selectedCategoryId, "")}
            aria-label="Quick add question"
          >
            {isCreatingQuestion ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
          </Button>
        ) : null}
      </main>
    </TooltipProvider>
  );
}
