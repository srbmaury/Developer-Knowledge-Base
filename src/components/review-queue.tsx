"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Brain, CheckCircle, ChevronRight, ChevronDown, Clock, Eye, Flame, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { TopNav } from "@/components/top-nav";
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

type ReviewHistoryItem = { date: string; title: string; grade: string };

function computeStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const dateSet = new Set(dates);
  const today = new Date().toISOString().split("T")[0];
  if (!dateSet.has(today)) return 0;
  let streak = 1;
  const d = new Date();
  for (;;) {
    d.setDate(d.getDate() - 1);
    if (dateSet.has(d.toISOString().split("T")[0])) streak++;
    else break;
  }
  return streak;
}

function formatHistoryDate(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return new Date(isoString).toLocaleDateString();
}

const DIFFICULTY_ORDER = { EASY: 0, MEDIUM: 1, HARD: 2 };

function sortReviewQueue(questions: Question[]): Question[] {
  return [...questions].sort((a, b) => {
    const aDaysLeft = daysUntilDue(a.srDue);
    const bDaysLeft = daysUntilDue(b.srDue);
    if (aDaysLeft !== bDaysLeft) return aDaysLeft - bDaysLeft;
    return DIFFICULTY_ORDER[b.difficulty] - DIFFICULTY_ORDER[a.difficulty];
  });
}

export function ReviewQueue({ initialCategories, userEmail }: { initialCategories: Category[]; userEmail?: string | null }) {
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
    try {
      const today = new Date().toISOString().split("T")[0];
      const rawDates = localStorage.getItem("dk:reviewDates");
      const dates: string[] = rawDates ? JSON.parse(rawDates) : [];
      if (!dates.includes(today)) { dates.push(today); localStorage.setItem("dk:reviewDates", JSON.stringify(dates)); }
      const rawHist = localStorage.getItem("dk:reviewHistory");
      const hist: ReviewHistoryItem[] = rawHist ? JSON.parse(rawHist) : [];
      hist.unshift({ date: new Date().toISOString(), title: current.title || "Untitled", grade });
      if (hist.length > 100) hist.pop();
      localStorage.setItem("dk:reviewHistory", JSON.stringify(hist));
    } catch { /* localStorage unavailable */ }
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
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav userEmail={userEmail ?? null} />
      {/* Sub-header: progress */}
      {!isEmpty && !done ? (
        <div className="flex h-10 shrink-0 items-center gap-3 border-b px-4">
          <Brain className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Review Queue</span>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{currentIndex + 1} / {dueQuestions.length}</span>
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${(currentIndex / dueQuestions.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      ) : null}

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

const GRADE_COLORS: Record<string, string> = {
  again: "text-rose-500",
  hard: "text-amber-500",
  good: "text-blue-500",
  easy: "text-emerald-500",
};

function EmptyState({ done, count, allQuestions, onBack }: {
  done: boolean;
  count: number;
  allQuestions: Question[];
  onBack: () => void;
}) {
  const [streak, setStreak] = useState(0);
  const [history, setHistory] = useState<ReviewHistoryItem[]>([]);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);

  useEffect(() => {
    try {
      const rawDates = localStorage.getItem("dk:reviewDates");
      setStreak(computeStreak(rawDates ? JSON.parse(rawDates) : []));
      const rawHist = localStorage.getItem("dk:reviewHistory");
      setHistory(rawHist ? JSON.parse(rawHist) : []);
    } catch { /* localStorage unavailable */ }
  }, [done]);

  const upcoming = allQuestions
    .filter((q) => q.srDue !== null && !isDue(q.srDue))
    .sort((a, b) => daysUntilDue(a.srDue) - daysUntilDue(b.srDue));
  const visibleUpcoming = showAllUpcoming ? upcoming : upcoming.slice(0, 5);

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
        {streak > 0 ? (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-orange-500/10 px-3 py-1 text-sm font-medium text-orange-600 dark:text-orange-400">
            <Flame className="h-4 w-4" />
            {streak}-day streak
          </div>
        ) : null}
      </div>
      {upcoming.length > 0 ? (
        <div className="w-full max-w-sm rounded-lg border bg-card p-4 text-left">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Coming up · {upcoming.length} enrolled
          </p>
          <ul className="space-y-2">
            {visibleUpcoming.map((q) => (
              <li key={q.id} className="flex items-center gap-2 text-sm">
                <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{q.title || "Untitled"}</span>
                <span className="shrink-0 text-xs text-muted-foreground">in {daysUntilDue(q.srDue)}d</span>
              </li>
            ))}
          </ul>
          {upcoming.length > 5 && !showAllUpcoming ? (
            <button
              onClick={() => setShowAllUpcoming(true)}
              className="mt-3 flex w-full items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className="h-3.5 w-3.5" />
              Show {upcoming.length - 5} more
            </button>
          ) : null}
        </div>
      ) : null}
      {done && history.length > 0 ? (
        <div className="w-full max-w-sm rounded-lg border bg-card p-4 text-left">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Recent reviews</p>
          <ul className="space-y-2">
            {history.slice(0, 8).map((item, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className={cn("shrink-0 text-xs font-semibold capitalize w-10", GRADE_COLORS[item.grade] ?? "text-muted-foreground")}>
                  {item.grade}
                </span>
                <span className="min-w-0 flex-1 truncate text-foreground">{item.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatHistoryDate(item.date)}</span>
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
