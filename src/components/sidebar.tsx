"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, type DragEndEvent, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronRight, ChevronDown, ChevronUp, Folder, FolderOpen, Globe2, GripVertical, Inbox, Lock, Moon, PanelLeftClose, Plus, Sun, Trash2 } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { Category } from "@/types/knowledge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function filterPendingCategories(cats: Category[], pendingIds: Set<string>): Category[] {
  return cats
    .filter((c) => !pendingIds.has(c.id))
    .map((c) => ({ ...c, children: filterPendingCategories(c.children, pendingIds) }));
}

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
  canCreateRootCategory,
  onCollapse
}: {
  canCreateRootCategory: boolean;
  onCollapse: () => void;
}) {
  const {
    categories,
    addCategory,
    deleteCategory,
    selectQuestion,
    selectCategory,
    toggleCategory,
  } = useWorkspaceStore();

  const [pendingRootName, setPendingRootName] = useState<string | null>(null);
  const [pendingDeleteCategoryIds, setPendingDeleteCategoryIds] = useState<Set<string>>(new Set());
  const deleteCategoryTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const timers = deleteCategoryTimers.current;
    return () => { timers.forEach(clearTimeout); };
  }, []);

  function handleDeleteCategoryRequest(categoryId: string) {
    const cat = findCategory(categories, categoryId);
    const name = cat?.name || "Untitled";
    setPendingDeleteCategoryIds((prev) => new Set([...prev, categoryId]));
    const timer = setTimeout(() => {
      void deleteCategory(categoryId);
      setPendingDeleteCategoryIds((prev) => { const n = new Set(prev); n.delete(categoryId); return n; });
      deleteCategoryTimers.current.delete(categoryId);
    }, 5000);
    deleteCategoryTimers.current.set(categoryId, timer);
    toast(`"${name}" deleted`, {
      action: {
        label: "Undo",
        onClick: () => {
          clearTimeout(deleteCategoryTimers.current.get(categoryId));
          deleteCategoryTimers.current.delete(categoryId);
          setPendingDeleteCategoryIds((prev) => { const n = new Set(prev); n.delete(categoryId); return n; });
        }
      },
      duration: 5000
    });
  }
  const { setTheme, resolvedTheme } = useTheme();
  const [themeMounted, setThemeMounted] = useState(false);
  useEffect(() => setThemeMounted(true), []);
  const router = useRouter();
  const searchParams = useSearchParams();

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
  }, [searchParams, selectCategory, selectQuestion]);

  const visibleCategories = filterPendingCategories(categories, pendingDeleteCategoryIds);
  const inboxCategory = visibleCategories.find((c) => c.name.toLowerCase() === "inbox") ?? null;
  const inboxCount = inboxCategory ? inboxCategory.questions.length : 0;

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
      <div className="flex h-14 shrink-0 items-center gap-2 border-b px-3">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-foreground text-background transition-opacity hover:opacity-80"
          aria-label="Go home"
          title="Home"
        >
          <span className="text-sm font-bold">DK</span>
        </button>
        <div className="min-w-0 flex-1 px-1">
          <p className="truncate text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{categories.length}</span> categories
            {" · "}
            <span className="font-medium text-foreground">{totalQuestionsCount(categories)}</span> notes
          </p>
        </div>
        <Button className="h-7 w-7" size="icon" variant="ghost" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} aria-label="Toggle theme" title={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
          {themeMounted ? (resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />) : <Moon className="h-4 w-4" />}
        </Button>
        <Button className="h-7 w-7" size="icon" variant="ghost" onClick={onCollapse} aria-label="Collapse sidebar" title="Collapse sidebar">
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </div>



      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          {inboxCategory ? (
            <button
              type="button"
              onClick={() => selectCategory(inboxCategory.id)}
              className="mb-3 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Inbox className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">Inbox</span>
              {inboxCount > 0 ? (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                  {inboxCount}
                </span>
              ) : null}
            </button>
          ) : null}
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
            <SortableContext items={visibleCategories.map((category) => category.id)} strategy={verticalListSortingStrategy}>
              <nav className="space-y-1">
                {visibleCategories.length === 0 && pendingRootName === null ? (
                  <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-8 text-center">
                    <Folder className="h-8 w-8 text-muted-foreground/50" />
                    <div>
                      <p className="text-sm font-medium">No categories yet</p>
                      <p className="mt-1 text-xs text-muted-foreground">Create a category to start organizing your notes.</p>
                    </div>
                    {canCreateRootCategory ? (
                      <Button size="sm" onClick={() => setPendingRootName("")}>
                        <Plus className="mr-1 h-4 w-4" /> New category
                      </Button>
                    ) : null}
                  </div>
                ) : null}
                {visibleCategories.map((category) => (
                  <CategoryNode
                    key={category.id}
                    category={category}
                    depth={0}
                    sensors={sensors}
                    onDragEnd={handleCategoryDragEnd}
                    onDeleteRequest={handleDeleteCategoryRequest}
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


function CategoryNode({ category, depth, sensors, onDragEnd, onDeleteRequest }: { category: Category; depth: number; sensors: ReturnType<typeof useSensors>; onDragEnd: (event: DragEndEvent, parentId: string | null) => void; onDeleteRequest: (id: string) => void }) {
  const {
    selectedCategoryId,
    expandedCategoryIds,
    selectCategory,
    toggleCategory,
    addCategory,
    updateCategoryName,
    updateCategoryVisibility,
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
                  onClick={() => onDeleteRequest(category.id)}
                  aria-label={`Delete ${category.name}`}
                  title={`Delete "${category.name}"`}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </>
            ) : null}
          </div>
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
                  onDeleteRequest={onDeleteRequest}
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
