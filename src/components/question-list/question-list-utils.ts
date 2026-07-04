import type { QuestionStatus } from "@/types/knowledge";

export function isInputFocused() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || (el as HTMLElement).isContentEditable;
}

export const STATUS_LABELS: Record<QuestionStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  SOLVED: "Solved"
};

export const STATUS_CLASSES: Record<QuestionStatus, string> = {
  NOT_STARTED: "bg-muted text-muted-foreground",
  IN_PROGRESS: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  SOLVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
};
