"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useTransition } from "react";
import { ChevronRight, Folder, FolderOpen, Globe2, Loader2, Lock, Moon, PanelLeftClose, Plus, Sun, Trash2 } from "lucide-react";
import { useTheme } from "next-themes";
import { buildRecentActivity, resolveQuestionIdFromActivity } from "@/lib/recent-activity";
import { formatRelativeDate, cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { Category } from "@/types/knowledge";
import { UserMenu } from "@/components/user-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function Sidebar({
  userEmail,
  workspaceTitle,
  workspaceSubtitle,
  canCreateRootCategory,
  onCollapse
}: {
  userEmail: string | null;
  workspaceTitle: string;
  workspaceSubtitle: string;
  canCreateRootCategory: boolean;
  onCollapse: () => void;
}) {
  const {
    categories,
    addCategory,
    selectQuestion,
    isRecentActivityOpen,
    toggleRecentActivity,
    creatingCategoryKeys
  } = useWorkspaceStore();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isNavigating, startNavigation] = useTransition();
  const isCreatingRootCategory = creatingCategoryKeys.includes("__root__");
  const recentActivity = useMemo(() => buildRecentActivity(categories), [categories]);

  // URL -> selected question
  useEffect(() => {
    const q = searchParams.get("q");
    if (!q) return;

    // flatten via recursive scan
    const exists = (() => {
      const stack = [...categories];
      while (stack.length) {
        const c = stack.pop()!;
        for (const qq of c.questions) if (qq.id === q) return true;
        stack.push(...c.children);
      }
      return false;
    })();

    if (exists) selectQuestion(q);
  }, [categories, searchParams, selectQuestion]);

  const { selectedQuestionId } = useWorkspaceStore();

  // selected question -> URL + visit count
  useEffect(() => {
    if (!selectedQuestionId) return;

    const url = new URL(window.location.href);
    if (url.searchParams.get("q") !== selectedQuestionId) {
      url.searchParams.set("q", selectedQuestionId);
      window.history.replaceState({}, "", url.toString());
    }

    const LS_KEY = "dk:questionVisitCounts";
    const raw = window.localStorage.getItem(LS_KEY);
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    map[selectedQuestionId] = (map[selectedQuestionId] ?? 0) + 1;
    window.localStorage.setItem(LS_KEY, JSON.stringify(map));
  }, [selectedQuestionId]);



  useEffect(() => {
    router.prefetch("/");
    router.prefetch("/public");
  }, [router]);



  return (
    <aside className="hidden h-full w-72 shrink-0 flex-col overflow-hidden border-r bg-card/80 backdrop-blur-xl md:flex">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-foreground text-background">
          <span className="text-sm font-bold">DK</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{workspaceTitle}</p>
          <p className="text-xs text-muted-foreground">{workspaceSubtitle}</p>
        </div>
        <Button className="ml-auto h-8 w-8" size="icon" variant="ghost" onClick={onCollapse} aria-label="Collapse categories sidebar">
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </div>



      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-3 flex items-center justify-between px-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Categories</p>
            {canCreateRootCategory ? (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                disabled={isCreatingRootCategory}
                onClick={() => void addCategory("New Category")}
              >
                {isCreatingRootCategory ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            ) : null}
          </div>
          <nav className="space-y-1">
            {categories.map((category) => (
              <CategoryNode key={category.id} category={category} depth={0} />
            ))}
          </nav>
        </div>

        <div className="shrink-0 border-t px-3 py-3">
        <button
          type="button"
          onClick={toggleRecentActivity}
          className="mb-2 flex w-full items-center justify-between px-1 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          <span>Recent activity</span>

          <span className="text-[10px]">
            {isRecentActivityOpen ? "−" : "+"}
          </span>
        </button>

        {isRecentActivityOpen && (
          <div className="max-h-40 space-y-2 overflow-y-auto">
            {recentActivity.length === 0 ? (
              <p className="px-1 text-xs text-muted-foreground">
                Edits will appear here.
              </p>
            ) : (
              recentActivity.map((activity) => (
                <button
                  key={activity.id}
                  type="button"
                  onClick={() => {
                    const questionId = resolveQuestionIdFromActivity(
                      categories,
                      activity.id
                    );

                    if (questionId) selectQuestion(questionId);
                  }}
                  className="w-full rounded-md border bg-background/60 p-2 text-left transition-colors hover:bg-muted/80"
                >
                  <p className="line-clamp-1 text-xs font-medium">
                    {activity.label}
                  </p>

                  <p className="line-clamp-1 text-xs text-muted-foreground">
                    {activity.detail}
                  </p>

                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatRelativeDate(activity.timestamp)}
                  </p>
                </button>
              ))
            )}
          </div>
        )}

        {/* Combined filter dropdown (top) */}
        <div className="border-b px-3 py-3">
          <label className="mb-1 block px-1 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Library
          </label>
          <div className="relative">
            <select
              className="w-full appearance-none rounded-md border bg-background/60 px-2 py-2 pr-8 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={pathname === "/public" ? "/public" : pathname === "/most-viewed" ? "/most-viewed" : pathname === "/starred" ? "/starred" : "/"}
              disabled={isNavigating}
              onChange={(e) => {
                const value = e.target.value as "/" | "/public" | "/most-viewed" | "/starred";
                startNavigation(() => {
                  router.push(value);
                });
              }}
            >
              <option value="/">Private</option>
              <option value="/public">Public</option>
              <option value="/most-viewed">Most Viewed</option>
              <option value="/starred">Starred</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-muted-foreground">
              <ChevronRight className="h-4 w-4 rotate-90" />
            </div>
          </div>
        </div>

      </div>
      </div>

      <div className="shrink-0 space-y-1 border-t p-3">
        <UserMenu email={userEmail} />
        <Button
          className="w-full justify-start"
          variant="ghost"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <span suppressHydrationWarning>
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </span>
          Toggle theme
        </Button>
      </div>
    </aside>
  );
}

function countSubtreeQuestions(category: Category): number {
  return (
    category.questions.length + category.children.reduce((sum, child) => sum + countSubtreeQuestions(child), 0)
  );
}

function CategoryNode({ category, depth }: { category: Category; depth: number }) {
  const {
    selectedCategoryId,
    expandedCategoryIds,
    selectCategory,
    toggleCategory,
    addCategory,
    updateCategoryName,
    updateCategoryVisibility,
    deleteCategory,
    creatingCategoryKeys
  } = useWorkspaceStore();
  const expanded = expandedCategoryIds.includes(category.id);
  const active = selectedCategoryId === category.id;
  const questionCount = countSubtreeQuestions(category);
  const isCreatingChildCategory = creatingCategoryKeys.includes(category.id);

  function handleDelete() {
    const parts = [`Delete "${category.name}"?`];
    if (category.children.length > 0) {
      parts.push(`This will also remove ${category.children.length} sub-categor${category.children.length === 1 ? "y" : "ies"}.`);
    }
    if (questionCount > 0) {
      parts.push(`This will also remove ${questionCount} question${questionCount === 1 ? "" : "s"}.`);
    }
    if (window.confirm(parts.join("\n\n"))) {
      deleteCategory(category.id);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0"
          onClick={() => toggleCategory(category.id)}
          aria-label={expanded ? "Collapse category" : "Expand category"}
        >
          <ChevronRight className={cn("h-4 w-4 transition-transform", expanded && "rotate-90")} />
        </Button>
        <div
          className={cn(
            "group flex h-8 min-w-0 flex-1 items-center rounded-md transition-colors hover:bg-muted",
            active && "bg-muted font-medium"
          )}
        >
          <div
            className="flex h-full min-w-0 flex-1 items-center gap-2 px-2 text-left text-sm"
            style={{ paddingLeft: `${depth * 10 + 8}px` }}
          >
            {expanded ? <FolderOpen className="h-4 w-4 shrink-0 text-accent" /> : <Folder className="h-4 w-4 shrink-0" />}
            {category.canEdit ? (
              <Input
                value={category.name}
                onChange={(event) => updateCategoryName(category.id, event.target.value)}
                onFocus={() => selectCategory(category.id)}
                onClick={(event) => {
                  event.stopPropagation();
                  selectCategory(category.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
                className="h-7 min-w-0 flex-1 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
                aria-label={`Rename ${category.name}`}
                placeholder="Untitled category"
              />
            ) : (
              <button
                type="button"
                onClick={() => selectCategory(category.id)}
                className="h-7 min-w-0 flex-1 truncate text-left text-sm"
              >
                {category.name || "Untitled category"}
              </button>
            )}
            <span className="ml-auto text-xs text-muted-foreground">{category.questions.length}</span>
          </div>
          <div className="hidden shrink-0 items-center group-hover:flex">
          {category.canEdit ? (
            <>
              <Button
                className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                size="icon"
                variant="ghost"
                onClick={() => updateCategoryVisibility(category.id, !category.isPublic)}
                aria-label={category.isPublic ? `Make ${category.name} private` : `Make ${category.name} public`}
                title={category.isPublic ? "Make private" : "Make public"}
              >
                {category.isPublic ? <Globe2 className="h-3.5 w-3.5 text-accent" /> : <Lock className="h-3.5 w-3.5" />}
              </Button>
              <Button
                className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                size="icon"
                variant="ghost"
                disabled={isCreatingChildCategory}
                onClick={() => void addCategory("New Sub-category", category.id)}
                aria-label={`Add sub-category to ${category.name}`}
                title="Add sub-category"
              >
                {isCreatingChildCategory ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              </Button>
              <Button
                className="mr-1 h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                size="icon"
                variant="ghost"
                onClick={handleDelete}
                aria-label={`Delete ${category.name}`}
                title="Delete category"
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </>
          ) : null}
          </div>
        </div>
      </div>
      {expanded && category.children.length > 0 ? (
        <div className="ml-5 border-l pl-1">
          {category.children.map((child) => (
            <CategoryNode key={child.id} category={child} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
