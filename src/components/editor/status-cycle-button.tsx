import type React from "react";
import { CheckCircle, Circle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuestionStatus } from "@/types/knowledge";

const STATUS_CONFIG: Record<QuestionStatus, { label: string; icon: React.ReactNode; className: string }> = {
  NOT_STARTED: {
    label: "Not started",
    icon: <Circle className="h-3 w-3" />,
    className: "text-muted-foreground border-muted-foreground/30 hover:border-muted-foreground/60"
  },
  IN_PROGRESS: {
    label: "In progress",
    icon: <Clock className="h-3 w-3 text-amber-500" />,
    className: "text-amber-600 border-amber-400/50 hover:border-amber-500 dark:text-amber-400"
  },
  SOLVED: {
    label: "Solved",
    icon: <CheckCircle className="h-3 w-3 text-emerald-500" />,
    className: "text-emerald-600 border-emerald-400/50 hover:border-emerald-500 dark:text-emerald-400"
  }
};

const STATUS_CYCLE: QuestionStatus[] = ["NOT_STARTED", "IN_PROGRESS", "SOLVED"];

export function StatusCycleButton({ status, onChange }: { status: QuestionStatus; onChange: (s: QuestionStatus) => void }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG["NOT_STARTED"];
  const safeStatus: QuestionStatus = STATUS_CONFIG[status] ? status : "NOT_STARTED";
  function next() {
    const idx = STATUS_CYCLE.indexOf(safeStatus);
    onChange(STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]);
  }
  return (
    <button
      onClick={next}
      className={cn("inline-flex min-h-10 items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors sm:min-h-0 sm:px-2.5 sm:py-0.5", config.className)}
      title={`Status: ${config.label} — click to change`}
    >
      {config.icon}
      {config.label}
    </button>
  );
}
