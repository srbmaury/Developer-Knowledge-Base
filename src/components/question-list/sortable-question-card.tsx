"use client";

import type { PointerEvent } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CheckSquare, GripVertical, Pin, Square, Star, Trash2 } from "lucide-react";
import { DIFFICULTIES, difficultyBadgeClass } from "@/lib/constants";
import { TAG_COLOR_CLASSES } from "@/lib/tag-colors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatRelativeDate } from "@/lib/utils";
import type { Question } from "@/types/knowledge";

function stopDragPointer(event: PointerEvent) {
  event.stopPropagation();
}

export function SortableQuestionCard({
  question,
  compact,
  selected,
  bulkSelected,
  bulkMode,
  canEdit,
  canDelete,
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
  canDelete?: boolean;
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

      {(canDelete ?? canEdit) ? (
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
