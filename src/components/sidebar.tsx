"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, type DragEndEvent, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Brain, ChevronRight, ChevronDown, ChevronUp, Eye, Folder, FolderOpen, Globe2, GripVertical, Home, Lock, Moon, PanelLeftClose, Plus, Star, Sun, Trash2 } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { Category } from "@/types/knowledge";
import { UserMenu } from "@/components/user-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function PendingCategoryInput({
  value,
  onChange,
  onCommit,
  onCancel,
  depth = 0
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  depth?: number;
}) {
  const escapeRef = useRef(false);
  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1" style={{ paddingLeft: `${depth * 10 + 8}px` }}>
      <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
      <Input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") { escapeRef.current = true; e.currentTarget.blur(); }
        }}
        onBlur={() => {
          if (escapeRef.current) { escapeRef.current = false; onCancel(); return; }
          if (value.trim()) onCommit(); else onCancel();
        }}
        placeholder="Category name"
        className="h-7 min-w-0 flex-1 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
      />
    </div>
  );
}

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
  } = useWorkspaceStore();
  const [pendingRootName, setPendingRootName] = useState<string | null>(null);
  const { setTheme, resolvedTheme } = useTheme();
  const [themeMounted, setThemeMounted] = useState(false);
  useEffect(() => setThemeMounted(true), []);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();


  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/most-viewed", label: "Most Viewed", icon: Eye },
    { href: "/starred", label: "Starred", icon: Star },
    { href: "/review", label: "Review Queue", icon: Brain },
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

  function totalSolvedCount(nodes: Category[]) {
    let solved = 0;
    const visit = (items: Category[]) => {
      for (const item of items) {
        solved += item.questions.filter((q) => q.status === "SOLVED").length;
        if (item.children?.length) visit(item.children);
      }
    };
    visit(nodes);
    return solved;
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
                  onClick={() => setPendingRootName("")}
                  title="New category"
                >
                  <Plus className="h-4 w-4" />
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
                {pendingRootName !== null ? (
                  <PendingCategoryInput
                    value={pendingRootName}
                    onChange={setPendingRootName}
                    onCommit={() => { void addCategory(pendingRootName.trim()); setPendingRootName(null); }}
                    onCancel={() => setPendingRootName(null)}
                  />
                ) : null}
              </nav>
            </SortableContext>
          </DndContext>
        </div>

        <div className="shrink-0 border-t px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              <div>Categories: <strong className="text-foreground">{categories.length}</strong></div>
              <div>Notes: <strong className="text-foreground">{totalQuestionsCount(categories)}</strong></div>
              {totalQuestionsCount(categories) > 0 ? (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${Math.round((totalSolvedCount(categories) / totalQuestionsCount(categories)) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] tabular-nums">{totalSolvedCount(categories)}/{totalQuestionsCount(categories)}</span>
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              {canCreateRootCategory ? (
                <Button size="sm" variant="ghost" onClick={() => setPendingRootName("")}>
                  <Plus className="h-4 w-4" /> Add
                </Button>
              ) : null}
              <Button className="h-8 w-8" size="icon" variant="ghost" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} aria-label="Toggle theme">
                {themeMounted ? (resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />) : <Moon className="h-4 w-4" />}
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

function countSubtreeSolved(category: Category): number {
  return (
    category.questions.filter((q) => q.status === "SOLVED").length +
    category.children.reduce((sum, child) => sum + countSubtreeSolved(child), 0)
  );
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
  } = useWorkspaceStore();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
    disabled: !category.canEdit
  });
  const expanded = expandedCategoryIds.includes(category.id);
  const active = selectedCategoryId === category.id;
  const questionCount = countSubtreeQuestions(category);
  const solvedCount = countSubtreeSolved(category);
  const [editing, setEditing] = useState(false);
  const [pendingChildName, setPendingChildName] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!confirmingDelete) return;
    const t = setTimeout(() => setConfirmingDelete(false), 3000);
    return () => clearTimeout(t);
  }, [confirmingDelete]);

  function handleDelete() {
    deleteCategory(category.id);
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
            {category.canEdit && editing ? (
              <Input
                autoFocus
                value={category.name}
                onChange={(event) => updateCategoryName(category.id, event.target.value)}
                onBlur={() => setEditing(false)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === "Escape") event.currentTarget.blur();
                }}
                className="h-7 min-w-0 flex-1 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
                placeholder="Category name"
              />
            ) : (
              <button
                type="button"
                onClick={() => selectCategory(category.id)}
                onDoubleClick={(e) => { if (category.canEdit) { e.preventDefault(); setEditing(true); } }}
                title={category.canEdit ? `${category.name || "Untitled"} · Double-click to rename` : category.name}
                className="h-7 min-w-0 flex-1 truncate text-left text-sm"
              >
                {category.name || "Untitled category"}
              </button>
            )}
            <span className="ml-auto text-xs text-muted-foreground" title={`${solvedCount}/${questionCount} solved`}>
              {questionCount}
            </span>
          </div>
          {confirmingDelete ? (
            <div className="ml-1 flex shrink-0 items-center gap-1 pr-1">
              <span className="text-[11px] text-muted-foreground">Delete?</span>
              <button
                onClick={() => { handleDelete(); setConfirmingDelete(false); }}
                className="rounded px-1.5 py-0.5 text-[11px] font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmingDelete(false)}
                className="rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                No
              </button>
            </div>
          ) : (
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
                  onClick={() => { if (!expanded) toggleCategory(category.id); setPendingChildName(""); }}
                  aria-label={`Add sub-category to ${category.name}`}
                  title="Add sub-category"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
                <Button
                  className="mr-1 h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                  size="icon"
                  variant="ghost"
                  onClick={() => setConfirmingDelete(true)}
                  aria-label={`Delete ${category.name}`}
                  title={`Delete "${category.name}"`}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </>
            ) : null}
            </div>
          )}
        </div>
      </div>
      {expanded && (category.children.length > 0 || pendingChildName !== null) ? (
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
          {pendingChildName !== null ? (
            <PendingCategoryInput
              value={pendingChildName}
              onChange={setPendingChildName}
              onCommit={() => { void addCategory(pendingChildName.trim(), category.id); setPendingChildName(null); }}
              onCancel={() => setPendingChildName(null)}
              depth={depth + 1}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
