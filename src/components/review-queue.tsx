"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Brain, CheckCircle, ChevronRight, Clock, Eye, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { isDue, daysUntilDue, computeNextSR } from "@/lib/spaced-repetition";
import type { SRGrade } from "@/lib/spaced-repetition";
import { getAllQuestions, useWorkspaceStore } from "@/store/workspace-store";
import { Button } from "@/components/ui/button";
import { MarkdownPreview } from "@/components/markdown-preview";
import { cn } from "@/lib/utils";
import type { Category, Question } from "@/types/knowledge";
import { DIFFICULTIES, difficultyBadgeClass } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { TAG_COLOR_CLASSES } from "@/lib/tag-colors";

const DIFFICULTY_ORDER = { EASY: 0, MEDIUM: 1, HARD: 2 };

function sortReviewQueue(questions: Question[]): Question[] {
  return [...questions].sort((a, b) => {
    const aDaysLeft = daysUntilDue(a.srDue);
    const bDaysLeft = daysUntilDue(b.srDue);
    if (aDaysLeft !== bDaysLeft) return aDaysLeft - bDaysLeft;
    return DIFFICULTY_ORDER[b.difficulty] - DIFFICULTY_ORDER[a.difficulty];
  });
}

export function ReviewQueue({ initialCategories }: { initialCategories: Category[] }) {
  const { categories, setInitialData, submitSpacedReview } = useWorkspaceStore();
  const router = useRouter();

  useEffect(() => {
    setInitialData(initialCategories);
  }, [initialCategories, setInitialData]);

  const allQuestions = getAllQuestions(categories);
  const dueQuestions = useMemo(
    () => sortReviewQueue(allQuestions.filter((q) => isDue(q.srDue))),
    [allQuestions]
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(false);

  const current = dueQuestions[currentIndex];

  function handleGrade(grade: SRGrade) {
    if (!current) return;
    submitSpacedReview(current.id, grade);
    const next = currentIndex + 1;
    if (next >= dueQuestions.length) {
      setDone(true);
    } else {
      setCurrentIndex(next);
      setRevealed(false);
    }
  }

  function skip() {
    const next = currentIndex + 1;
    if (next >= dueQuestions.length) setDone(true);
    else { setCurrentIndex(next); setRevealed(false); }
  }

  const isEmpty = dueQuestions.length === 0;

  return (
    <div className="flex min-h-full flex-col bg-background">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur-sm">
        <Button variant="ghost" size="icon" onClick={() => router.push("/")} aria-label="Back to workspace">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          <span className="font-semibold">Review Queue</span>
        </div>
        {!isEmpty && !done ? (
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{currentIndex + 1} / {dueQuestions.length}</span>
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${(currentIndex / dueQuestions.length) * 100}%` }}
              />
            </div>
          </div>
        ) : null}
      </header>

      {/* Content */}
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        {done || isEmpty ? (
          <EmptyState done={done} count={dueQuestions.length} allQuestions={allQuestions} onBack={() => router.push("/")} />
        ) : (
          <ReviewCard
            question={current}
            revealed={revealed}
            onReveal={() => setRevealed(true)}
            onGrade={handleGrade}
            onSkip={skip}
          />
        )}
      </div>
    </div>
  );
}

function EmptyState({ done, count, allQuestions, onBack }: {
  done: boolean;
  count: number;
  allQuestions: Question[];
  onBack: () => void;
}) {
  const upcoming = allQuestions
    .filter((q) => !isDue(q.srDue))
    .sort((a, b) => daysUntilDue(a.srDue) - daysUntilDue(b.srDue))
    .slice(0, 5);

  return (
    <div className="flex flex-col items-center gap-6 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
        <CheckCircle className="h-8 w-8 text-emerald-500" />
      </div>
      <div>
        <h1 className="text-2xl font-bold">All caught up!</h1>
        <p className="mt-2 text-muted-foreground">
          {done
            ? `You reviewed ${count} question${count === 1 ? "" : "s"}.`
            : "No questions are due for review right now."}
        </p>
      </div>
      {upcoming.length > 0 ? (
        <div className="w-full max-w-sm rounded-lg border bg-card p-4 text-left">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Coming up</p>
          <ul className="space-y-2">
            {upcoming.map((q) => (
              <li key={q.id} className="flex items-center gap-2 text-sm">
                <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{q.title || "Untitled"}</span>
                <span className="shrink-0 text-xs text-muted-foreground">in {daysUntilDue(q.srDue)}d</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <Button variant="outline" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to workspace
      </Button>
    </div>
  );
}

function ReviewCard({ question, revealed, onReveal, onGrade, onSkip }: {
  question: Question;
  revealed: boolean;
  onReveal: () => void;
  onGrade: (g: SRGrade) => void;
  onSkip: () => void;
}) {
  const difficulty = DIFFICULTIES.find((d) => d.value === question.difficulty);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card shadow-sm">
        {/* Question */}
        <div className="border-b p-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {difficulty ? (
              <Badge className={difficultyBadgeClass(question.difficulty)}>{difficulty.label}</Badge>
            ) : null}
            {question.tags.map((tag) => (
              <span key={tag.id} className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", TAG_COLOR_CLASSES[tag.color])}>
                {tag.name}
              </span>
            ))}
            <span className="ml-auto text-xs text-muted-foreground">
              {question.srReviews > 0 ? `${question.srReviews} review${question.srReviews === 1 ? "" : "s"} · every ${question.srInterval}d` : "First review"}
            </span>
          </div>
          <h2 className="text-xl font-bold">{question.title || "Untitled question"}</h2>
          {question.description ? (
            <p className="mt-2 text-sm text-muted-foreground">{question.description}</p>
          ) : null}
        </div>

        {/* Answer */}
        <div className="p-6">
          {!revealed ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <p className="text-sm text-muted-foreground">Think through your answer, then reveal</p>
              <Button onClick={onReveal}>
                <Eye className="mr-2 h-4 w-4" /> Reveal answer
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {question.solutions.map((sol) => (
                <div key={sol.id}>
                  {question.solutions.length > 1 ? (
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{sol.title}</p>
                  ) : null}
                  {sol.content ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <MarkdownPreview content={sol.content} />
                    </div>
                  ) : (
                    <p className="text-sm italic text-muted-foreground">No content yet</p>
                  )}
                  {sol.notes ? (
                    <div className="mt-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{sol.notes}</div>
                  ) : null}
                </div>
              ))}

              {/* Grade buttons */}
              <div className="border-t pt-4">
                <p className="mb-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  How well did you recall this?
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {(["again", "hard", "good", "easy"] as SRGrade[]).map((grade) => {
                    const styles: Record<SRGrade, string> = {
                      again: "border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950",
                      hard:  "border-amber-300 text-amber-600 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950",
                      good:  "border-blue-300 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950",
                      easy:  "border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950"
                    };
                    const nextDays = computeNextSR(
                      { interval: question.srInterval, ease: question.srEase, reviews: question.srReviews },
                      grade
                    ).interval;
                    return (
                      <Button key={grade} variant="outline" className={cn("flex-col gap-0.5 h-auto py-2", styles[grade])} onClick={() => onGrade(grade)}>
                        <span className="capitalize font-medium">{grade === "again" ? <><RotateCcw className="inline h-3 w-3 mr-1" />Again</> : grade.charAt(0).toUpperCase() + grade.slice(1)}</span>
                        <span className="text-[10px] opacity-60">{nextDays}d</span>
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-center">
        <button onClick={onSkip} className="text-xs text-muted-foreground underline-offset-2 hover:underline">
          Skip for now <ChevronRight className="inline h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
