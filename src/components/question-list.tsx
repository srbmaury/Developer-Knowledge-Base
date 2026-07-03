"use client";

import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowUpDown, Check, CheckSquare, Download, Filter, FolderInput, GripVertical, Loader2, MoreHorizontal, PanelRightClose, Pin, Plus, Square, Star, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { DIFFICULTIES, difficultyBadgeClass } from "@/lib/constants";
import { TAG_COLOR_CLASSES, TAG_DOT_CLASSES } from "@/lib/tag-colors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatRelativeDate } from "@/lib/utils";
import {
  getAllQuestions,
  getCategoryById,
  getCategoryForQuestion,
  sortQuestionsForDisplay,
  useWorkspaceStore
} from "@/store/workspace-store";
import type { Category, Question, QuestionStatus, Tag } from "@/types/knowledge";
import { parseMarkdownFile, exportWorkspaceToZip } from "@/lib/workspace-io";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

function flatCategoryList(cats: Category[], parentPath = ""): Array<{ id: string; name: string; path: string; canEdit: boolean }> {
  return cats.flatMap((cat) => {
    const full = parentPath ? `${parentPath} / ${cat.name}` : cat.name;
    return [{ id: cat.id, name: cat.name, path: parentPath, canEdit: cat.canEdit }, ...flatCategoryList(cat.children, full)];
  });
}


function CategoryPickerDialog({
  open,
  excludeId,
  categories,
  onSelect,
  onClose
}: {
  open: boolean;
  excludeId?: string | null;
  categories: Category[];
  onSelect: (categoryId: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const flat = flatCategoryList(categories).filter((c) => c.canEdit && c.id !== excludeId);
  const filtered = search.trim()
    ? flat.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : flat;
  useEffect(() => { if (!open) setSearch(""); }, [open]);
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogTitle className="text-base font-semibold">Move to category</DialogTitle>
        <Input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search categories…" className="mb-1" />
        <div className="max-h-64 overflow-y-auto space-y-0.5 rounded-md border p-1">
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">No categories found</p>
          ) : filtered.map((c) => (
            <button key={c.id} onClick={() => { onSelect(c.id); onClose(); }}
              className="flex w-full flex-col rounded-md px-3 py-2 text-left text-sm hover:bg-muted">
              <span className="font-medium">{c.name}</span>
              {c.path ? <span className="text-xs text-muted-foreground">{c.path}</span> : null}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function isInputFocused() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || (el as HTMLElement).isContentEditable;
}

const SORT_OPTIONS = [
  { value: "default", label: "Default" },
  { value: "title-asc", label: "Title A–Z" },
  { value: "title-desc", label: "Title Z–A" },
  { value: "newest", label: "Recently updated" },
  { value: "oldest", label: "Oldest first" },
] as const;
type SortOption = typeof SORT_OPTIONS[number]["value"];

function sortWithinGroup(qs: Question[], sort: SortOption): Question[] {
  if (sort === "default") return qs;
  const sorted = [...qs];
  switch (sort) {
    case "title-asc": return sorted.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    case "title-desc": return sorted.sort((a, b) => (b.title || "").localeCompare(a.title || ""));
    case "newest": return sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    case "oldest": return sorted.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
  }
}

function SortDropdown({ sort, onChange }: { sort: SortOption; onChange: (s: SortOption) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const active = sort !== "default";
  const activeLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all",
          active
            ? "bg-primary/10 text-primary ring-2 ring-primary ring-offset-1"
            : "bg-muted text-muted-foreground hover:text-foreground"
        )}
      >
        <ArrowUpDown className="h-3 w-3" />
        {active ? activeLabel : "Sort"}
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-44 rounded-lg border bg-card p-1 shadow-lg">
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => { onChange(option.value); setOpen(false); }}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                sort === option.value ? "bg-primary/10 text-primary" : "hover:bg-muted"
              )}
            >
              <span className="flex-1 text-left font-medium">{option.label}</span>
              {sort === option.value ? <span className="text-[10px] font-bold">✓</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const STATUS_LABELS: Record<QuestionStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  SOLVED: "Solved"
};

const STATUS_CLASSES: Record<QuestionStatus, string> = {
  NOT_STARTED: "bg-muted text-muted-foreground",
  IN_PROGRESS: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  SOLVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
};

function TagFilterDropdown({
  allTags,
  filterTagIds,
  toggleTagFilter,
  clearTagFilter
}: {
  allTags: Tag[];
  filterTagIds: string[];
  toggleTagFilter: (id: string) => void;
  clearTagFilter: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (allTags.length === 0) return null;
  const activeCount = filterTagIds.length;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all",
          activeCount > 0
            ? "bg-primary/10 text-primary ring-2 ring-primary ring-offset-1"
            : "bg-muted text-muted-foreground hover:text-foreground"
        )}
      >
        <Filter className="h-3 w-3" />
        Tags
        {activeCount > 0 ? (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
            {activeCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-48 rounded-lg border bg-card p-1 shadow-lg">
          {allTags.map((tag) => {
            const active = filterTagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                onClick={() => toggleTagFilter(tag.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                  active ? "bg-primary/10 text-primary" : "hover:bg-muted"
                )}
              >
                <span className={cn("h-2 w-2 shrink-0 rounded-full", TAG_DOT_CLASSES[tag.color])} />
                <span className="flex-1 text-left font-medium">{tag.name}</span>
                {active ? <span className="text-[10px] font-bold">✓</span> : null}
              </button>
            );
          })}
          {activeCount > 0 ? (
            <div className="mt-1 border-t pt-1">
              <button
                onClick={() => { clearTagFilter(); setOpen(false); }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3 w-3" /> Clear tag filters
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function stopDragPointer(event: React.PointerEvent) {
  event.stopPropagation();
}


function SortableQuestionCard({
  question,
  compact,
  selected,
  bulkSelected,
  bulkMode,
  canEdit,
  categoryLabel,
  onSelect,
  onDelete,
  onBulkToggle
}: {
  question: Question;
  compact: boolean;
  selected: boolean;
  bulkSelected?: boolean;
  bulkMode?: boolean;
  canEdit: boolean;
  categoryLabel?: string;
  onSelect: () => void;
  onDelete: () => void;
  onBulkToggle?: () => void;
}) {
  const isTemp = question.id.startsWith("temp-");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
    disabled: !canEdit
  });
  const difficulty = DIFFICULTIES.find((item) => item.value === question.difficulty);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, touchAction: "none" }}
      className={cn(
        "group relative w-full rounded-lg border bg-card p-3 text-left shadow-sm transition-[box-shadow,border-color] hover:border-primary/40 hover:shadow-md",
        selected && "border-primary/60 ring-1 ring-primary/30",
        isDragging && "z-10 border-primary/50 opacity-90 shadow-lg",
        compact && "min-w-72 shrink-0",
        isTemp && "cursor-default opacity-60"
      )}
      {...(canEdit ? attributes : {})}
      {...(canEdit ? listeners : {})}
    >
      {bulkMode ? (
        <div className="absolute left-2 top-3 flex h-7 w-5 items-center justify-center" onClick={(e) => { e.stopPropagation(); onBulkToggle?.(); }}>
          {bulkSelected
            ? <CheckSquare className="h-4 w-4 text-primary" />
            : <Square className="h-4 w-4 text-muted-foreground" />}
        </div>
      ) : canEdit ? (
        <div
          className="absolute left-2 top-3 flex h-7 w-5 cursor-grab items-center justify-center text-muted-foreground/50 group-hover:text-muted-foreground active:cursor-grabbing"
          aria-hidden
        >
          <GripVertical className="h-4 w-4" />
        </div>
      ) : null}

      <div
        role="button"
        tabIndex={0}
        className="w-full cursor-pointer pl-7 text-left"
        title={`${question.title || "Untitled question"}${question.description ? ` - ${question.description}` : ""}`}
        onClick={bulkMode ? onBulkToggle : onSelect}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (bulkMode) {
              onBulkToggle?.();
            } else {
              onSelect();
            }
          }
        }}
      >
        <div className="flex items-start gap-2 pr-8">
          <div className="min-w-0 flex-1">
            {categoryLabel ? (
              <p className="mb-0.5 truncate text-[10px] text-muted-foreground/60">{categoryLabel}</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-1.5">
              {question.isPinned ? <Pin className="h-3.5 w-3.5 text-accent" /> : null}
              <p className="line-clamp-2 text-sm font-semibold" title={question.title || "Untitled question"}>{question.title || "Untitled question"}</p>
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground" title={question.description}>{question.description}</p>
            {difficulty ? (
              <Badge className={cn("mt-2", difficultyBadgeClass(question.difficulty))}>{difficulty.label}</Badge>
            ) : null}
            {question.tags.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {question.tags.map((tag) => (
                  <span key={tag.id} className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium", TAG_COLOR_CLASSES[tag.color])}>
                    {tag.name}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          {question.isFavorite ? <Star className="h-4 w-4 shrink-0 fill-amber-400 text-amber-400" /> : null}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">Updated {formatRelativeDate(question.updatedAt)}</p>
      </div>

      {canEdit ? (
        <Button
          className="absolute right-2 top-2 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
          size="icon"
          variant="ghost"
          onPointerDown={stopDragPointer}
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          aria-label={`Delete ${question.title}`}
          title="Delete question"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      ) : null}
    </div>
  );
}

export function QuestionList({ compact = false, onCollapse, emptyMessage }: { compact?: boolean; onCollapse?: () => void; emptyMessage?: string }) {
  const {
    categories,
    selectedCategoryId,
    selectedQuestionId,
    selectQuestion,
    addQuestion,
    deleteQuestion,
    moveQuestion,
    enrollInReview,
    reorderQuestions,
    creatingQuestionCategoryIds,
    allTags,
    filterTagIds,
    toggleTagFilter,
    clearTagFilter,
    filterStatus,
    setStatusFilter
  } = useWorkspaceStore();

  const [showAllCategories, setShowAllCategories] = useState(false);
  const isGlobalMode = showAllCategories || !selectedCategoryId;
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
  const deleteTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [sortOption, setSortOption] = useState<SortOption>("default");
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedBulkIds, setSelectedBulkIds] = useState<Set<string>>(new Set());
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const headerMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!headerMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) setHeaderMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [headerMenuOpen]);

  useEffect(() => {
    const timers = deleteTimers.current;
    return () => { timers.forEach(clearTimeout); };
  }, []);

  function handleDeleteQuestion(question: Question) {
    const id = question.id;
    setPendingDeleteIds((prev) => new Set([...prev, id]));
    const timer = setTimeout(() => {
      void deleteQuestion(id);
      setPendingDeleteIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
      deleteTimers.current.delete(id);
    }, 5000);
    deleteTimers.current.set(id, timer);
    toast(`"${question.title || "Untitled"}" deleted`, {
      action: {
        label: "Undo",
        onClick: () => {
          clearTimeout(deleteTimers.current.get(id));
          deleteTimers.current.delete(id);
          setPendingDeleteIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
        }
      },
      duration: 5000
    });
  }

  async function handleImportFile(file: File) {
    if (!selectedCategoryId || !canEditSelectedCategory) return;
    const text = await file.text();
    const { title, description, difficulty, tagNames, content } = parseMarkdownFile(file.name, text);
    await addQuestion(selectedCategoryId, title);

    const state = useWorkspaceStore.getState();
    const questionId = state.selectedQuestionId;
    const solutionId = state.selectedSolutionId;

    if (questionId && !questionId.startsWith("temp-")) {
      if (description) state.updateQuestionDescription(questionId, description);
      if (difficulty) state.updateQuestionDifficulty(questionId, difficulty);
      for (const name of tagNames) {
        const tag = state.allTags.find((t) => t.name.toLowerCase() === name.toLowerCase());
        if (tag) state.addTagToQuestion(questionId, tag.id);
      }
    }
    if (solutionId && !solutionId.startsWith("temp-")) {
      state.updateSolutionContent(solutionId, content);
    }
  }

  function toggleBulkSelect(id: string) {
    setSelectedBulkIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleBulkDelete() {
    for (const id of selectedBulkIds) {
      const q = questions.find((q) => q.id === id);
      if (q) handleDeleteQuestion(q);
    }
    setSelectedBulkIds(new Set());
    setBulkMode(false);
  }

  function handleBulkEnroll() {
    for (const id of selectedBulkIds) enrollInReview(id);
    setSelectedBulkIds(new Set());
    setBulkMode(false);
    toast.success(`Enrolled ${selectedBulkIds.size} question${selectedBulkIds.size === 1 ? "" : "s"} in review`);
  }

  function handleBulkMove(targetCategoryId: string) {
    for (const id of selectedBulkIds) moveQuestion(id, targetCategoryId);
    setSelectedBulkIds(new Set());
    setBulkMode(false);
  }

  const allFilteredQuestions = sortQuestionsForDisplay(
    getAllQuestions(categories).filter((question) =>
      isGlobalMode || !selectedCategoryId || question.categoryId === selectedCategoryId
    )
  );
  const questions = allFilteredQuestions
    .filter((q) => !pendingDeleteIds.has(q.id))
    .filter((q) => !filterStatus || (q.status ?? "NOT_STARTED") === filterStatus)
    .filter((q) => filterTagIds.length === 0 || filterTagIds.every((id) => q.tags.some((t) => t.id === id)));
  const pinnedQuestions = sortWithinGroup(questions.filter((question) => question.isPinned), sortOption);
  const unpinnedQuestions = sortWithinGroup(questions.filter((question) => !question.isPinned), sortOption);
  const selectedCategory = getCategoryById(categories, selectedCategoryId);
  const canEditSelectedCategory = selectedCategory?.canEdit ?? false;
  const isCreatingQuestion = Boolean(
    selectedCategoryId && creatingQuestionCategoryIds.includes(selectedCategoryId)
  );

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      if (isInputFocused()) return;
      if (questions.length === 0) return;
      e.preventDefault();
      const idx = questions.findIndex((q) => q.id === selectedQuestionId);
      const next = idx < 0 ? 0 : e.key === "ArrowDown"
        ? Math.min(idx + 1, questions.length - 1)
        : Math.max(idx - 1, 0);
      if (idx !== next) selectQuestion(questions[next].id);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [questions, selectedQuestionId, selectQuestion]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent, group: "pinned" | "unpinned") {
    const { active, over } = event;
    const list = group === "pinned" ? pinnedQuestions : unpinnedQuestions;
    if (!over || active.id === over.id || list.length < 2) return;

    const oldIndex = list.findIndex((question) => question.id === active.id);
    const newIndex = list.findIndex((question) => question.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reorderedGroup = arrayMove(list, oldIndex, newIndex);
    const mergedIds = [
      ...(group === "pinned" ? reorderedGroup : pinnedQuestions).map((question) => question.id),
      ...(group === "unpinned" ? reorderedGroup : unpinnedQuestions).map((question) => question.id)
    ];
    const categoryId = list[0]?.categoryId ?? selectedCategoryId;
    if (!categoryId) return;
    const category = getCategoryById(categories, categoryId);
    if (!category?.canEdit) return;

    reorderQuestions(categoryId, mergedIds);
  }

  function renderQuestionCard(question: Question, opts?: { global?: boolean }) {
    const isTemp = question.id.startsWith("temp-");
    const category = getCategoryForQuestion(categories, question.id);
    const canEdit = !isTemp && !opts?.global && (category?.canEdit ?? false);
    return (
      <SortableQuestionCard
        key={question.id}
        question={question}
        compact={compact}
        selected={selectedQuestionId === question.id}
        bulkMode={bulkMode}
        bulkSelected={selectedBulkIds.has(question.id)}
        canEdit={canEdit}
        categoryLabel={opts?.global ? category?.name : undefined}
        onSelect={isTemp ? () => {} : () => selectQuestion(question.id)}
        onDelete={() => handleDeleteQuestion(question)}
        onBulkToggle={() => toggleBulkSelect(question.id)}
      />
    );
  }

  return (
    <div className={cn("flex h-full min-h-0 min-w-0 flex-col", compact && "max-h-64")}>
      {!compact ? (
        <>
          <div className="flex h-14 items-center justify-between border-b px-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {!isGlobalMode && selectedCategory ? selectedCategory.name : "Questions"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isGlobalMode && selectedCategory
                  ? `${questions.length} across all categories`
                  : `${questions.length} note${questions.length === 1 ? "" : "s"}${!isGlobalMode && questions.length > 1 ? " · drag to reorder" : ""}`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {canEditSelectedCategory ? (
                <>
                  <div ref={headerMenuRef} className="relative">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setHeaderMenuOpen((o) => !o)}
                      aria-label="More options"
                      title="More options"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                    {headerMenuOpen ? (
                      <div className="absolute right-0 top-full z-50 mt-1 min-w-56 rounded-lg border bg-card p-1 shadow-lg">
                        <button
                          onClick={() => { setBulkMode((b) => !b); setSelectedBulkIds(new Set()); setHeaderMenuOpen(false); }}
                          className={cn("flex w-full items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-sm hover:bg-muted", bulkMode && "text-primary font-medium")}
                        >
                          <CheckSquare className="h-4 w-4" />
                          {bulkMode ? "Exit select mode" : "Select multiple"}
                        </button>
                        <button
                          onClick={() => { importInputRef.current?.click(); setHeaderMenuOpen(false); }}
                          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm hover:bg-muted"
                        >
                          <Upload className="h-4 w-4" />
                          Import Markdown
                        </button>
                        <button
                          onClick={() => {
                            void exportWorkspaceToZip(categories, {
                              selectedCategoryId: isGlobalMode ? null : selectedCategoryId,
                              filterStatus,
                              filterTagIds
                            });
                            setHeaderMenuOpen(false);
                          }}
                          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm hover:bg-muted"
                        >
                          <Download className="h-4 w-4" />
                          Export current view
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept=".md,.markdown,text/markdown"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleImportFile(file);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={isCreatingQuestion}
                    onClick={() => selectedCategoryId && void addQuestion(selectedCategoryId, "")}
                    aria-label="Add question"
                    title="Add question"
                  >
                    {isCreatingQuestion ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  </Button>
                </>
              ) : null}
              {onCollapse ? (
                <Button size="icon" variant="ghost" onClick={onCollapse} aria-label="Collapse questions sidebar">
                  <PanelRightClose className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 border-b px-3 py-2">
            {selectedCategoryId ? (
              <button
                onClick={() => setShowAllCategories((v) => !v)}
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all",
                  showAllCategories
                    ? "bg-primary/10 text-primary ring-2 ring-primary ring-offset-1"
                    : "bg-muted text-muted-foreground opacity-60 hover:opacity-100"
                )}
              >
                All categories
              </button>
            ) : null}
            {(["NOT_STARTED", "IN_PROGRESS", "SOLVED"] as QuestionStatus[]).map((s) => {
              const active = filterStatus === s;
              const count = allFilteredQuestions.filter((q) => (q.status ?? "NOT_STARTED") === s).length;
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(active ? null : s)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all",
                    STATUS_CLASSES[s],
                    active ? "ring-2 ring-primary ring-offset-1" : "opacity-60 hover:opacity-100"
                  )}
                >
                  {STATUS_LABELS[s]}
                  <span className="opacity-70">{count}</span>
                </button>
              );
            })}
            <TagFilterDropdown
              allTags={allTags}
              filterTagIds={filterTagIds}
              toggleTagFilter={toggleTagFilter}
              clearTagFilter={clearTagFilter}
            />
            <SortDropdown sort={sortOption} onChange={setSortOption} />
            {(filterTagIds.length > 0 || filterStatus || sortOption !== "default") ? (
              <button
                onClick={() => { clearTagFilter(); setStatusFilter(null); setSortOption("default"); }}
                className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" /> Clear all
              </button>
            ) : null}
          </div>
          {bulkMode && selectedBulkIds.size > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 border-b bg-primary/5 px-3 py-2">
              <span className="text-xs font-medium text-primary">{selectedBulkIds.size} selected</span>
              <div className="ml-auto flex items-center gap-1">
                <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"
                  onClick={() => setSelectedBulkIds(
                    new Set(questions.filter((q) => !q.id.startsWith("temp-")).map((q) => q.id))
                  )}>
                  <Check className="h-3 w-3" /> All
                </Button>
                <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"
                  onClick={() => setBulkMoveOpen(true)}>
                  <FolderInput className="h-3 w-3" /> Move
                </Button>
                <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-primary"
                  onClick={handleBulkEnroll}>
                  Enroll
                </Button>
                <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-destructive"
                  onClick={handleBulkDelete}>
                  <Trash2 className="h-3 w-3" /> Delete
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs"
                  onClick={() => { setBulkMode(false); setSelectedBulkIds(new Set()); }}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ) : null}
          <CategoryPickerDialog
            open={bulkMoveOpen}
            excludeId={selectedCategoryId}
            categories={categories}
            onSelect={handleBulkMove}
            onClose={() => setBulkMoveOpen(false)}
          />
        </>
      ) : null}
      <div
        className={cn(
          "min-h-0 min-w-0 flex-1 overflow-y-auto p-3",
          compact ? "flex gap-2 overflow-x-auto" : "space-y-2"
        )}
      >
        {questions.length === 0 ? (
          <div className="flex min-h-44 flex-col items-center justify-center rounded-lg border border-dashed p-5 text-center">
            <p className="text-sm font-medium">No questions yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {emptyMessage ?? (canEditSelectedCategory ? "Create one to start collecting snippets and approaches." : "No public questions here yet.")}
            </p>
            {canEditSelectedCategory ? (
              <Button
                className="mt-4"
                size="sm"
                disabled={isCreatingQuestion}
                onClick={() => selectedCategoryId && void addQuestion(selectedCategoryId, "")}
              >
                {isCreatingQuestion ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {isCreatingQuestion ? "Adding" : "Add question"}
              </Button>
            ) : null}
          </div>
        ) : isGlobalMode ? (
          <div className="space-y-2">
            {questions.map((question) => renderQuestionCard(question, { global: true }))}
          </div>
        ) : (
          <div className={cn(compact ? "flex gap-2" : "space-y-3")}>
            {pinnedQuestions.length > 0 ? (
              <div className={cn(compact ? "flex gap-2" : "space-y-2")}>
                {!compact ? (
                  <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Pinned</p>
                ) : null}
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(event) => handleDragEnd(event, "pinned")}
                >
                  <SortableContext items={pinnedQuestions.map((question) => question.id)} strategy={verticalListSortingStrategy}>
                    <div className={cn(compact ? "flex gap-2" : "space-y-2")}>
                      {pinnedQuestions.map((question) => renderQuestionCard(question))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            ) : null}
            {unpinnedQuestions.length > 0 ? (
              <div className={cn(compact ? "flex gap-2" : "space-y-2")}>
                {!compact && pinnedQuestions.length > 0 ? (
                  <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Notes</p>
                ) : null}
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(event) => handleDragEnd(event, "unpinned")}
                >
                  <SortableContext
                    items={unpinnedQuestions.map((question) => question.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className={cn(compact ? "flex gap-2" : "space-y-2")}>
                      {unpinnedQuestions.map((question) => renderQuestionCard(question))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
