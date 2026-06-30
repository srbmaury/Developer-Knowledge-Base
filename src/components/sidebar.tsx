"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, type DragEndEvent, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronRight, ChevronDown, ChevronUp, Eye, Folder, FolderOpen, Globe2, GripVertical, Home, Loader2, Lock, Moon, PanelLeftClose, Plus, Star, Sun, Trash2 } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { Category } from "@/types/knowledge";
import { UserMenu } from "@/components/user-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function findCategory(categories: Category[], categoryId: string): Category | null {
  for (const category of categories) {
    if (category.id === categoryId) return category;
    const nested = findCategory(category.children, categoryId);
    if (nested) return nested;
  }
  return null;
}

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
    selectCategory,
    toggleCategory,
    creatingCategoryKeys
  } = useWorkspaceStore();
  const { theme, setTheme } = useTheme();
  const [themeMounted, setThemeMounted] = useState(false);
  useEffect(() => setThemeMounted(true), []);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isCreatingRootCategory = creatingCategoryKeys.includes("__root__");

  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/most-viewed", label: "Most Viewed", icon: Eye },
    { href: "/starred", label: "Starred", icon: Star },
    { href: "/public", label: "Public", icon: Globe2 },
  ] as const;
  const currentNav = navItems.find((item) => item.href === pathname) ?? navItems[0];
  const [isNavOpen, setIsNavOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isNavOpen) return;
    function handleOutsideClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setIsNavOpen(false);
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isNavOpen]);

  function collectAllCategoryIds(nodes: Category[]) {
    const ids: string[] = [];
    const visit = (items: Category[]) => {
      for (const item of items) {
        ids.push(item.id);
        if (item.children?.length) visit(item.children);
      }
    };
    visit(nodes);
    return ids;
  }

  function totalQuestionsCount(nodes: Category[]) {
    let total = 0;
    const visit = (items: Category[]) => {
      for (const item of items) {
        total += item.questions.length;
        if (item.children?.length) visit(item.children);
      }
    };
    visit(nodes);
    return total;
  }

  function expandAll() {
    const allIds = collectAllCategoryIds(categories);
    const expanded = useWorkspaceStore.getState().expandedCategoryIds;
    for (const id of allIds) {
      if (!expanded.includes(id)) toggleCategory(id);
    }
  }

  function collapseAll() {
    const expanded = [...useWorkspaceStore.getState().expandedCategoryIds];
    for (const id of expanded) toggleCategory(id);
  }

  // Keep a ref so the URL→question effect can read current categories
  // without being in its dependency array (avoids overriding optimistic selection
  // every time categories mutate).
  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;

  // URL -> selected category or question (only on real URL navigation, not on store mutations).
  // ?q= is the canonical URL state; categories take priority so a shared category link
  // lands on the right category even when questions are also present.
  useEffect(() => {
    const q = searchParams.get("q");
    if (!q) return;

    const cats = categoriesRef.current;

    const findCategory = (id: string) => {
      const stack = [...cats];
      while (stack.length) {
        const c = stack.pop()!;
        if (c.id === id) return true;
        stack.push(...c.children);
      }
      return false;
    };

    const findQuestion = (id: string) => {
      const stack = [...cats];
      while (stack.length) {
        const c = stack.pop()!;
        for (const qq of c.questions) if (qq.id === id) return true;
        stack.push(...c.children);
      }
      return false;
    };

    if (findCategory(q)) { selectCategory(q); return; }
    if (findQuestion(q)) { selectQuestion(q); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, selectCategory, selectQuestion]);

  const { selectedQuestionId, reorderCategories } = useWorkspaceStore();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 4 } }),
    useSensor(KeyboardSensor)
  );

  function handleCategoryDragEnd(event: DragEndEvent, parentId: string | null) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const siblings = parentId === null ? categories : findCategory(categories, parentId)?.children ?? [];
    const ids = siblings.map((category) => category.id);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    if (oldIndex < 0 || newIndex < 0) return;

    reorderCategories(parentId, arrayMove(ids, oldIndex, newIndex));
  }

  // Track visit counts for most-viewed (no URL write — category owns ?q=)
  useEffect(() => {
    if (!selectedQuestionId) return;
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
    <aside className="flex h-full w-full shrink-0 flex-col overflow-hidden border-r bg-card/80 backdrop-blur-xl md:flex">
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



      <div ref={navRef} className="relative shrink-0 border-b px-3 py-2">
        <button
          type="button"
          onClick={() => setIsNavOpen((prev) => !prev)}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
        >
          <currentNav.icon className="h-4 w-4" />
          <span className="flex-1 text-left">{currentNav.label}</span>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isNavOpen && "rotate-180")} />
        </button>
        {isNavOpen && (
          <div className="absolute left-3 right-3 top-full z-50 mt-1 rounded-md border bg-card shadow-md">
            {navItems.map(({ href, label, icon: Icon }) => (
              <button
                key={href}
                type="button"
                onClick={() => { router.push(href); setIsNavOpen(false); }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors first:rounded-t-md last:rounded-b-md hover:bg-muted",
                  pathname === href && "bg-muted font-medium"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-3 flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Categories</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={expandAll} aria-label="Expand all categories" title="Expand all">
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={collapseAll} aria-label="Collapse all categories" title="Collapse all">
                <ChevronUp className="h-4 w-4" />
              </Button>
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
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => handleCategoryDragEnd(event, null)}>
            <SortableContext items={categories.map((category) => category.id)} strategy={verticalListSortingStrategy}>
              <nav className="space-y-1">
                {categories.map((category) => (
                  <CategoryNode
                    key={category.id}
                    category={category}
                    depth={0}
                    sensors={sensors}
                    onDragEnd={handleCategoryDragEnd}
                  />
                ))}
              </nav>
            </SortableContext>
          </DndContext>
        </div>

        <div className="shrink-0 border-t px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              <div>Categories: <strong className="text-foreground">{categories.length}</strong></div>
              <div>Notes: <strong className="text-foreground">{totalQuestionsCount(categories)}</strong></div>
            </div>

            <div className="flex items-center gap-2">
              {canCreateRootCategory ? (
                <Button size="sm" variant="ghost" onClick={() => void addCategory("New Category")} disabled={isCreatingRootCategory}>
                  {isCreatingRootCategory ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
                </Button>
              ) : null}
              <Button className="h-8 w-8" size="icon" variant="ghost" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle theme">
                {themeMounted ? (theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />) : <Moon className="h-4 w-4" />}
              </Button>
            </div>
          </div>

        </div>

      </div>

      <div className="shrink-0 space-y-1 border-t p-3">
        <UserMenu email={userEmail} />
      </div>
    </aside>
  );
}

function countSubtreeQuestions(category: Category): number {
  return (
    category.questions.length + category.children.reduce((sum, child) => sum + countSubtreeQuestions(child), 0)
  );
}

function countSubcategories(category: Category): number {
  return category.children.length + category.children.reduce((sum, child) => sum + countSubcategories(child), 0);
}

function CategoryNode({ category, depth, sensors, onDragEnd }: { category: Category; depth: number; sensors: ReturnType<typeof useSensors>; onDragEnd: (event: DragEndEvent, parentId: string | null) => void }) {
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
    disabled: !category.canEdit
  });
  const expanded = expandedCategoryIds.includes(category.id);
  const active = selectedCategoryId === category.id;
  const questionCount = countSubtreeQuestions(category);
  const subcategoryCount = countSubcategories(category);
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
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "opacity-80", "rounded-md")}
    >
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
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted/80 hover:text-foreground"
                {...attributes}
                {...listeners}
                aria-label={`Reorder ${category.name}`}
                title="Drag to reorder"
              >
                <GripVertical className="h-4 w-4" />
              </button>
            ) : null}
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
                title={category.name || "Untitled category"}
                className="h-7 min-w-0 flex-1 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
                aria-label={`Rename ${category.name}`}
                placeholder="Untitled category"
              />
            ) : (
              <button
                type="button"
                onClick={() => selectCategory(category.id)}
                title={category.name || "Untitled category"}
                className="h-7 min-w-0 flex-1 truncate text-left text-sm"
              >
                {category.name || "Untitled category"}
              </button>
            )}
            <span
              className="ml-auto text-xs text-muted-foreground"
              title={`${category.questions.length} direct · ${subcategoryCount} subcategories · ${questionCount} total`}
            >
              {questionCount}
            </span>
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
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => onDragEnd(event, category.id)}>
            <SortableContext items={category.children.map((child) => child.id)} strategy={verticalListSortingStrategy}>
              {category.children.map((child) => (
                <CategoryNode
                  key={child.id}
                  category={child}
                  depth={depth + 1}
                  sensors={sensors}
                  onDragEnd={onDragEnd}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      ) : null}
    </div>
  );
}
