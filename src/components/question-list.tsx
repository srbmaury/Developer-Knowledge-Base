"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
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
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { Check, CheckSquare, Download, FolderInput, Loader2, MoreHorizontal, PanelRightClose, Plus, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getAllQuestions,
  getCategoryById,
  getCategoryForQuestion,
  sortQuestionsForDisplay,
  useWorkspaceStore
} from "@/store/workspace-store";
import type { Question, QuestionStatus } from "@/types/knowledge";
import { parseMarkdownFile, exportWorkspaceToZip } from "@/lib/workspace-io";
import { CategoryPickerDialog } from "@/components/question-list/category-picker-dialog";
import { SORT_OPTIONS, SortDropdown, sortWithinGroup, type SortOption } from "@/components/question-list/sort-dropdown";
import { TagFilterDropdown } from "@/components/question-list/tag-filter-dropdown";
import { SortableQuestionCard } from "@/components/question-list/sortable-question-card";
import { isInputFocused, STATUS_CLASSES, STATUS_LABELS } from "@/components/question-list/question-list-utils";

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

    // Capture IDs immediately after addQuestion resolves — do not re-read from store later,
    // because the user may have clicked a different question during the network round-trip.
    const state = useWorkspaceStore.getState();
    const questionId = state.selectedQuestionId;
    const solutionId = state.selectedSolutionId;

    if (!questionId || questionId.startsWith("temp-")) return;

    if (description) state.updateQuestionDescription(questionId, description);
    if (difficulty) state.updateQuestionDifficulty(questionId, difficulty);
    for (const name of tagNames) {
      const tag = state.allTags.find((t) => t.name.toLowerCase() === name.toLowerCase());
      if (tag) state.addTagToQuestion(questionId, tag.id);
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
  const activeFilterLabels = [
    filterStatus ? `Status: ${STATUS_LABELS[filterStatus]}` : null,
    filterTagIds.length > 0
      ? `Tags: ${allTags.filter((tag) => filterTagIds.includes(tag.id)).map((tag) => tag.name).join(", ")}`
      : null,
    sortOption !== "default" ? `Sort: ${SORT_OPTIONS.find((option) => option.value === sortOption)?.label ?? sortOption}` : null
  ].filter(Boolean) as string[];
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

  const VIRTUAL_THRESHOLD = 40;
  const shouldVirtualize = !compact && questions.length >= VIRTUAL_THRESHOLD;

  type VItem = { k: "q"; question: Question; global: boolean } | { k: "h"; label: string };
  const vItems = useMemo<VItem[]>(() => {
    if (!shouldVirtualize) return [];
    if (isGlobalMode) return questions.map((q) => ({ k: "q" as const, question: q, global: true }));
    const out: VItem[] = [];
    if (pinnedQuestions.length > 0) {
      out.push({ k: "h", label: "Pinned" });
      for (const q of pinnedQuestions) out.push({ k: "q", question: q, global: false });
    }
    if (unpinnedQuestions.length > 0) {
      if (pinnedQuestions.length > 0) out.push({ k: "h", label: "Notes" });
      for (const q of unpinnedQuestions) out.push({ k: "q", question: q, global: false });
    }
    return out;
  }, [shouldVirtualize, isGlobalMode, questions, pinnedQuestions, unpinnedQuestions]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: vItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => (vItems[i]?.k === "h" ? 32 : 120),
    overscan: 8,
  });

  function renderQuestionCard(question: Question, opts?: { global?: boolean; virtual?: boolean }) {
    const isTemp = question.id.startsWith("temp-");
    const category = getCategoryForQuestion(categories, question.id);
    const canOwn = !isTemp && (category?.canEdit ?? false);
    // canDrag is disabled in virtual/global modes (DnD doesn't work there); delete is always available to owners
    const canEdit = canOwn && !opts?.global && !opts?.virtual;
    const canDelete = canOwn;
    return (
      <SortableQuestionCard
        key={question.id}
        question={question}
        compact={compact}
        selected={selectedQuestionId === question.id}
        bulkMode={bulkMode}
        bulkSelected={selectedBulkIds.has(question.id)}
        canEdit={canEdit}
        canDelete={canDelete}
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
                          Export filtered view
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
            {activeFilterLabels.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 rounded-full bg-muted/20 px-2 py-1 text-[11px] text-muted-foreground">
                <span className="font-medium text-muted-foreground">Active filters:</span>
                {activeFilterLabels.map((label) => (
                  <span key={label} className="rounded-full bg-background px-2 py-1 text-[11px] text-muted-foreground shadow-sm">
                    {label}
                  </span>
                ))}
              </div>
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
      {shouldVirtualize ? (
        <div ref={scrollRef} className="min-h-0 min-w-0 flex-1 overflow-y-auto p-3">
          <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
            {virtualizer.getVirtualItems().map((vi) => {
              const item = vItems[vi.index];
              return (
                <div
                  key={vi.key}
                  data-index={vi.index}
                  ref={virtualizer.measureElement}
                  style={{ position: "absolute", top: 0, left: 0, right: 0, transform: `translateY(${vi.start}px)` }}
                >
                  {item.k === "h" ? (
                    <p className="pb-1 pt-2 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{item.label}</p>
                  ) : (
                    <div className="pb-2">{renderQuestionCard(item.question, { global: item.global, virtual: true })}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
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
      )}
    </div>
  );
}
