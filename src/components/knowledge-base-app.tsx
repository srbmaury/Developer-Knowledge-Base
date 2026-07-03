"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useHotkeys, useSequenceHotkey, useSingleHotkey } from "@/components/use-hotkeys";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CommandPalette } from "@/components/command-palette";
import { QuickCaptureModal } from "@/components/quick-capture-modal";
import { EditorPane } from "@/components/editor-pane";
import { QuestionList } from "@/components/question-list";
import { Sidebar } from "@/components/sidebar";
import { TopNav } from "@/components/top-nav";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getCategoryById, useWorkspaceStore } from "@/store/workspace-store";
import type { Category, Tag } from "@/types/knowledge";
import { ListCollapse, Loader2, PanelLeftOpen, PanelRightClose, PanelRightOpen, Plus, Search } from "lucide-react";

export function KnowledgeBaseApp({
  initialCategories,
  initialTags,
  userEmail,
  canCreateRootCategory = true,
  emptyMessage
}: {
  initialCategories: Category[];
  initialTags?: Tag[];
  userEmail: string | null;
  canCreateRootCategory?: boolean;
  emptyMessage?: string;
}) {
  const router = useRouter();
  const {
    categories,
    setInitialData,
    setAllTags,
    setCommandOpen,
    setShortcutsOpen,
    shortcutsOpen,
    selectedCategoryId,
    addQuestion,
    creatingQuestionCategoryIds
  } = useWorkspaceStore();
  const [categoriesOpen, setCategoriesOpen] = useState(true);
  const [questionsOpen, setQuestionsOpen] = useState(true);
  const [isMac, setIsMac] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [focusHintVisible, setFocusHintVisible] = useState(false);
  const focusHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  useEffect(() => { setIsMac(/Mac|iPhone|iPad|iPod/.test(navigator.platform)); }, []);
  const [categoriesWidth, setCategoriesWidth] = useState(288);
  const [questionsWidth, setQuestionsWidth] = useState(320);
  const [resizing, setResizing] = useState<"categories" | "questions" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Restore persisted widths after mount (avoids SSR/hydration mismatch)
  useEffect(() => {
    const cw = Number(localStorage.getItem("dk:categoriesWidth"));
    const qw = Number(localStorage.getItem("dk:questionsWidth"));
    if (cw >= 200 && cw <= 500) setCategoriesWidth(cw);
    if (qw >= 200 && qw <= 500) setQuestionsWidth(qw);
  }, []);

  useEffect(() => {
    setInitialData(initialCategories);
  }, [initialCategories, setInitialData]);

  useEffect(() => {
    if (initialTags) setAllTags(initialTags);
  }, [initialTags, setAllTags]);

  useHotkeys("ctrl+k", () => setCommandOpen(true));
  useHotkeys("meta+k", () => setCommandOpen(true));
  useSingleHotkey("?", () => setShortcutsOpen(true));

  useSingleHotkey("n", () => setCaptureOpen(true));
  useSingleHotkey("f", () => {
    setFocusMode((f) => {
      const next = !f;
      if (next) {
        if (focusHintTimer.current) clearTimeout(focusHintTimer.current);
        setFocusHintVisible(true);
        focusHintTimer.current = setTimeout(() => setFocusHintVisible(false), 2500);
      }
      return next;
    });
  });

  // g → h/m/s/p navigation (GitHub-style, ignored when an input is focused)
  useSequenceHotkey("g", "h", () => router.push("/"));
  useSequenceHotkey("g", "m", () => router.push("/most-viewed"));
  useSequenceHotkey("g", "s", () => router.push("/starred"));
  useSequenceHotkey("g", "p", () => router.push("/public"));

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

    const handleMouseUp = (e: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        if (resizing === "categories") {
          localStorage.setItem("dk:categoriesWidth", String(Math.max(200, Math.min(500, x))));
        } else if (resizing === "questions") {
          const start = categoriesOpen ? categoriesWidth + 4 : 0;
          localStorage.setItem("dk:questionsWidth", String(Math.max(200, Math.min(500, x - start))));
        }
      }
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
      <div className="flex h-screen flex-col overflow-hidden bg-background/85 text-foreground">
        {!focusMode ? <TopNav userEmail={userEmail} /> : null}
        <main ref={containerRef} className="flex flex-1 min-h-0 overflow-hidden">
        {!focusMode && categoriesOpen ? (
          <>
            <div className="hidden h-full shrink-0 overflow-hidden md:flex" style={{ width: `${categoriesWidth}px` }}>
              <Sidebar
                canCreateRootCategory={canCreateRootCategory}
                onCollapse={() => setCategoriesOpen(false)}
              />
            </div>
            <div
              role="separator"
              aria-label="Resize categories sidebar"
              aria-orientation="vertical"
              className="hidden h-full w-1 cursor-col-resize select-none bg-transparent hover:bg-primary/20 md:block"
              onMouseDown={() => setResizing("categories")}
            />
          </>
        ) : null}
        {!focusMode && questionsOpen ? (
          <>
            <section className="hidden h-full min-w-0 shrink-0 overflow-hidden border-r bg-background/70 lg:flex lg:flex-col" style={{ width: `${questionsWidth}px` }}>
              <QuestionList onCollapse={() => setQuestionsOpen(false)} emptyMessage={emptyMessage} />
            </section>
            <div
              role="separator"
              aria-label="Resize questions sidebar"
              aria-orientation="vertical"
              className="hidden h-full w-1 cursor-col-resize select-none bg-transparent hover:bg-primary/20 lg:block"
              onMouseDown={() => setResizing("questions")}
            />
          </>
        ) : null}
        <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {focusHintVisible ? (
            <div className="pointer-events-none absolute bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border bg-card/90 px-4 py-2 text-xs text-muted-foreground shadow-lg backdrop-blur-sm transition-opacity duration-500">
              Press <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">F</kbd> to exit focus mode
            </div>
          ) : null}
          <header className={cn("sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur-xl sm:px-5", focusMode && "hidden")}>
            <Button
              variant="ghost"
              size="icon"
              className="hidden md:inline-flex"
              onClick={() => setCategoriesOpen((open) => !open)}
              aria-label={categoriesOpen ? "Collapse sidebar" : "Expand sidebar"}
              title={categoriesOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:inline-flex"
              onClick={() => setQuestionsOpen((open) => !open)}
              aria-label={questionsOpen ? "Collapse question list" : "Expand question list"}
              title={questionsOpen ? "Collapse question list" : "Expand question list"}
            >
              {questionsOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Questions" title="Questions">
              <ListCollapse className="h-4 w-4" />
            </Button>
            <button
              onClick={() => setCommandOpen(true)}
              className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border bg-card px-3 text-left text-sm text-muted-foreground shadow-sm transition-colors hover:bg-muted"
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="truncate">Search questions, snippets, categories...</span>
              <kbd className="ml-auto hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] sm:inline">{isMac ? "⌘K" : "Ctrl K"}</kbd>
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
          {!focusMode ? (
            <div className="grid min-h-0 shrink-0 grid-cols-1 lg:hidden">
              <div className="max-h-72 overflow-hidden border-b bg-background/70 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{selectedCategoryName}</p>
                <QuestionList compact emptyMessage={emptyMessage} />
              </div>
            </div>
          ) : null}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain" data-scroll="editor">
            <EditorPane />
          </div>
        </section>
        <CommandPalette />
        <QuickCaptureModal open={captureOpen} onClose={() => setCaptureOpen(false)} />
        <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
          <DialogContent className="max-w-sm">
            <DialogTitle className="text-base font-semibold">Keyboard shortcuts</DialogTitle>
            <div className="space-y-1 text-sm">
              {[
                { keys: isMac ? ["⌘", "K"] : ["Ctrl", "K"], label: "Open search" },
                { keys: ["g", "h"], label: "Go to Home" },
                { keys: ["g", "m"], label: "Go to Most Viewed" },
                { keys: ["g", "s"], label: "Go to Starred" },
                { keys: ["g", "p"], label: "Go to Public" },
                { keys: ["?"], label: "Show shortcuts" },
                { keys: ["F"], label: "Toggle focus mode" },
                { keys: ["N"], label: "Quick capture" },
              ].map(({ keys, label }) => (
                <div key={label} className="flex items-center justify-between gap-4 rounded-md px-2 py-1.5 hover:bg-muted">
                  <span className="text-muted-foreground">{label}</span>
                  <div className="flex items-center gap-1">
                    {keys.map((k) => (
                      <kbd key={k} className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px]">{k}</kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
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
      </div>
    </TooltipProvider>
  );
}
