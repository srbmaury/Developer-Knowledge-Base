"use client";

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
import { GripVertical, Loader2, PanelRightClose, Pin, Plus, Star, Trash2 } from "lucide-react";
import { DIFFICULTIES, difficultyBadgeClass } from "@/lib/constants";
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
import type { Question } from "@/types/knowledge";

function stopDragPointer(event: React.PointerEvent) {
  event.stopPropagation();
}

function SortableQuestionCard({
  question,
  compact,
  selected,
  canEdit,
  onSelect,
  onDelete
}: {
  question: Question;
  compact: boolean;
  selected: boolean;
  canEdit: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
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
        compact && "min-w-72 shrink-0"
      )}
      {...(canEdit ? attributes : {})}
      {...(canEdit ? listeners : {})}
    >
      {canEdit ? (
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
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect();
          }
        }}
      >
        <div className="flex items-start gap-2 pr-8">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {question.isPinned ? <Pin className="h-3.5 w-3.5 text-accent" /> : null}
              <p className="line-clamp-2 text-sm font-semibold" title={question.title || "Untitled question"}>{question.title || "Untitled question"}</p>
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground" title={question.description}>{question.description}</p>
            {difficulty ? (
              <Badge className={cn("mt-2", difficultyBadgeClass(question.difficulty))}>{difficulty.label}</Badge>
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

export function QuestionList({ compact = false, onCollapse }: { compact?: boolean; onCollapse?: () => void }) {
  const {
    categories,
    selectedCategoryId,
    selectedQuestionId,
    selectQuestion,
    addQuestion,
    deleteQuestion,
    reorderQuestions,
    creatingQuestionCategoryIds
  } = useWorkspaceStore();

  const questions = sortQuestionsForDisplay(
    getAllQuestions(categories).filter((question) => !selectedCategoryId || question.categoryId === selectedCategoryId)
  );
  const pinnedQuestions = questions.filter((question) => question.isPinned);
  const unpinnedQuestions = questions.filter((question) => !question.isPinned);
  const selectedCategory = getCategoryById(categories, selectedCategoryId);
  const canEditSelectedCategory = selectedCategory?.canEdit ?? false;
  const isCreatingQuestion = Boolean(
    selectedCategoryId && creatingQuestionCategoryIds.includes(selectedCategoryId)
  );

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

  function renderQuestionCard(question: Question) {
    const canEdit = getCategoryForQuestion(categories, question.id)?.canEdit ?? false;
    return (
      <SortableQuestionCard
        key={question.id}
        question={question}
        compact={compact}
        selected={selectedQuestionId === question.id}
        canEdit={canEdit}
        onSelect={() => selectQuestion(question.id)}
        onDelete={() => {
          if (window.confirm(`Delete "${question.title || "Untitled question"}"?`)) {
            deleteQuestion(question.id);
          }
        }}
      />
    );
  }

  return (
    <div className={cn("flex h-full min-h-0 min-w-0 flex-col", compact && "max-h-64")}>
      {!compact ? (
        <div className="flex h-14 items-center justify-between border-b px-4">
          <div>
            <p className="text-sm font-semibold">Questions</p>
            <p className="text-xs text-muted-foreground">
              {questions.length} saved notes
              {questions.length > 1 ? " · drag to reorder within pinned or other notes" : ""}
            </p>
          </div>
          {canEditSelectedCategory ? (
            <Button
              size="icon"
              variant="ghost"
              disabled={isCreatingQuestion}
              onClick={() => selectedCategoryId && void addQuestion(selectedCategoryId, "")}
              aria-label="Add question"
            >
              {isCreatingQuestion ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          ) : null}
          {onCollapse ? (
            <Button size="icon" variant="ghost" onClick={onCollapse} aria-label="Collapse questions sidebar">
              <PanelRightClose className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
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
              {canEditSelectedCategory ? "Create one to start collecting snippets and approaches." : "No public questions here yet."}
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
