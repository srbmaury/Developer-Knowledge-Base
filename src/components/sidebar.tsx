"use client";

import { useMemo } from "react";
import { ChevronRight, Folder, FolderOpen, Moon, PanelLeftClose, Plus, Sun, Trash2 } from "lucide-react";
import { useTheme } from "next-themes";
import { buildRecentActivity, resolveQuestionIdFromActivity } from "@/lib/recent-activity";
import { formatRelativeDate, cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { Category } from "@/types/knowledge";
import { UserMenu } from "@/components/user-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function Sidebar({ userEmail, onCollapse }: { userEmail: string | null; onCollapse: () => void }) {
  const { categories, addCategory, selectQuestion } = useWorkspaceStore();
  const { theme, setTheme } = useTheme();
  const recentActivity = useMemo(() => buildRecentActivity(categories), [categories]);

  return (
    <aside className="hidden h-full w-72 shrink-0 flex-col overflow-hidden border-r bg-card/80 backdrop-blur-xl md:flex">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-foreground text-background">
          <span className="text-sm font-bold">DK</span>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">Developer Knowledge Base</p>
          <p className="text-xs text-muted-foreground">Your private workspace</p>
        </div>
        <Button className="ml-auto h-8 w-8" size="icon" variant="ghost" onClick={onCollapse} aria-label="Collapse categories sidebar">
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-3 flex items-center justify-between px-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Categories</p>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => void addCategory("New Category")}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <nav className="space-y-1">
            {categories.map((category) => (
              <CategoryNode key={category.id} category={category} depth={0} />
            ))}
          </nav>
        </div>

        <div className="shrink-0 border-t px-3 py-3">
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent activity</p>
          <div className="max-h-40 space-y-2 overflow-y-auto">
            {recentActivity.length === 0 ? (
              <p className="px-1 text-xs text-muted-foreground">Edits will appear here.</p>
            ) : (
              recentActivity.map((activity) => (
                <button
                  key={activity.id}
                  type="button"
                  onClick={() => {
                    const questionId = resolveQuestionIdFromActivity(categories, activity.id);
                    if (questionId) selectQuestion(questionId);
                  }}
                  className="w-full rounded-md border bg-background/60 p-2 text-left transition-colors hover:bg-muted/80"
                >
                  <p className="line-clamp-1 text-xs font-medium">{activity.label}</p>
                  <p className="line-clamp-1 text-xs text-muted-foreground">{activity.detail}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{formatRelativeDate(activity.timestamp)}</p>
                </button>
              ))
            )}
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
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
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
    deleteCategory
  } = useWorkspaceStore();
  const expanded = expandedCategoryIds.includes(category.id);
  const active = selectedCategoryId === category.id;
  const questionCount = countSubtreeQuestions(category);

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
            <span className="ml-auto text-xs text-muted-foreground">{category.questions.length}</span>
          </div>
          <Button
            className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
            size="icon"
            variant="ghost"
            onClick={() => void addCategory("New Sub-category", category.id)}
            aria-label={`Add sub-category to ${category.name}`}
            title="Add sub-category"
          >
            <Plus className="h-3.5 w-3.5" />
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
