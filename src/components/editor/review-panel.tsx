"use client";

import { useEffect, useRef } from "react";
import { AlertCircle, CheckCircle2, Lightbulb, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ReviewResult } from "@/lib/ai-answer";

const RATING_STYLES: Record<ReviewResult["rating"], string> = {
  good: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  "needs-work": "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  poor: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20"
};

const RATING_LABEL: Record<ReviewResult["rating"], string> = {
  good: "Good",
  "needs-work": "Needs work",
  poor: "Poor"
};

export function ReviewPanel({ review, autoScroll, onDismiss }: { review: ReviewResult; autoScroll: boolean; onDismiss: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll) ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    // autoScroll is intentionally read only at mount time
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={ref} className="border-t px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">AI Review</p>
          <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", RATING_STYLES[review.rating])}>
            {RATING_LABEL[review.rating]}
          </span>
        </div>
        <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={onDismiss} aria-label="Dismiss review">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">{review.summary}</p>
      {review.feedback.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {review.feedback.map((item, i) => (
            <li key={i} className="flex gap-2.5 text-sm">
              {item.type === "strength" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              ) : item.type === "issue" ? (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              ) : (
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
              )}
              <span className="leading-snug">{item.text}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
