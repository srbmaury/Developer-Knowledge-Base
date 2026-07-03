"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart2, Brain, CheckCircle, Clock, Flame, Star, TrendingUp } from "lucide-react";
import { TopNav } from "@/components/top-nav";
import { getAllQuestions, useWorkspaceStore } from "@/store/workspace-store";
import { isDue } from "@/lib/spaced-repetition";
import { cn } from "@/lib/utils";
import type { Category } from "@/types/knowledge";

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

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-bold">{value}</p>
          {sub ? <p className="mt-1 text-sm text-muted-foreground">{sub}</p> : null}
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-full", color)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function CategoryBar({ category, maxCount }: { category: Category & { totalQ: number; solvedQ: number }; maxCount: number }) {
  const pct = category.totalQ > 0 ? Math.round((category.solvedQ / category.totalQ) * 100) : 0;
  const barWidth = maxCount > 0 ? (category.totalQ / maxCount) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="min-w-0 flex-1 truncate font-medium">{category.name}</span>
        <span className="ml-3 shrink-0 text-xs text-muted-foreground">{category.solvedQ}/{category.totalQ} solved</span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="absolute inset-y-0 left-0 rounded-full bg-muted-foreground/20" style={{ width: `${barWidth}%` }} />
        <div className="absolute inset-y-0 left-0 rounded-full bg-emerald-500" style={{ width: `${barWidth * pct / 100}%` }} />
      </div>
      <p className="text-[11px] text-muted-foreground">{pct}% solved</p>
    </div>
  );
}

export function StatsClient({ initialCategories, userEmail }: { initialCategories: Category[]; userEmail: string | null }) {
  const { categories, setInitialData } = useWorkspaceStore();

  useEffect(() => { setInitialData(initialCategories); }, [initialCategories, setInitialData]);

  const [streak, setStreak] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);

  useEffect(() => {
    try {
      const rawDates = localStorage.getItem("dk:reviewDates");
      setStreak(computeStreak(rawDates ? JSON.parse(rawDates) : []));
      const rawHist = localStorage.getItem("dk:reviewHistory");
      const hist: unknown[] = rawHist ? JSON.parse(rawHist) : [];
      setReviewCount(hist.length);
    } catch { /* ignore */ }
  }, []);

  const allQuestions = getAllQuestions(categories);

  const overview = useMemo(() => {
    const total = allQuestions.length;
    const solved = allQuestions.filter((q) => q.status === "SOLVED").length;
    const inProgress = allQuestions.filter((q) => q.status === "IN_PROGRESS").length;
    const enrolled = allQuestions.filter((q) => q.srDue !== null).length;
    const due = allQuestions.filter((q) => isDue(q.srDue)).length;
    const favorites = allQuestions.filter((q) => q.isFavorite).length;
    return { total, solved, inProgress, enrolled, due, favorites };
  }, [allQuestions]);

  const categoryStats = useMemo(() => {
    function flatten(cats: Category[]): Category[] {
      return cats.flatMap((c) => [c, ...flatten(c.children)]);
    }
    return flatten(categories)
      .map((cat) => {
        const qs = allQuestions.filter((q) => q.categoryId === cat.id);
        return { ...cat, totalQ: qs.length, solvedQ: qs.filter((q) => q.status === "SOLVED").length };
      })
      .filter((c) => c.totalQ > 0)
      .sort((a, b) => b.totalQ - a.totalQ);
  }, [categories, allQuestions]);

  const maxCount = categoryStats[0]?.totalQ ?? 1;
  const solvedPct = overview.total > 0 ? Math.round((overview.solved / overview.total) * 100) : 0;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav userEmail={userEmail} />
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        <div className="mb-8">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <BarChart2 className="h-6 w-6 text-primary" />
            Knowledge Stats
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">An overview of your learning progress</p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard label="Total notes" value={overview.total} sub={`${categories.length} categories`} icon={TrendingUp} color="bg-blue-500/10 text-blue-600 dark:text-blue-400" />
          <StatCard label="Solved" value={`${solvedPct}%`} sub={`${overview.solved} of ${overview.total}`} icon={CheckCircle} color="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" />
          <StatCard label="In progress" value={overview.inProgress} sub="notes" icon={Clock} color="bg-amber-500/10 text-amber-600 dark:text-amber-400" />
          <StatCard label="Favourites" value={overview.favorites} sub="starred notes" icon={Star} color="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" />
          <StatCard label="In review" value={overview.enrolled} sub={overview.due > 0 ? `${overview.due} due now` : "all caught up"} icon={Brain} color="bg-primary/10 text-primary" />
          <StatCard label="Reviews done" value={reviewCount} sub="all time" icon={CheckCircle} color="bg-purple-500/10 text-purple-600 dark:text-purple-400" />
          {streak > 0 ? (
            <StatCard label="Current streak" value={`${streak}d`} sub="consecutive days" icon={Flame} color="bg-orange-500/10 text-orange-600 dark:text-orange-400" />
          ) : null}
        </div>

        {overview.total > 0 ? (
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Overall progress</h2>
              <span className="text-sm text-muted-foreground">{solvedPct}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${solvedPct}%` }} />
            </div>
          </div>
        ) : null}

        {categoryStats.length > 0 ? (
          <div className="mt-8">
            <h2 className="mb-4 text-base font-semibold">By category</h2>
            <div className="space-y-5 rounded-xl border bg-card p-5 shadow-sm">
              {categoryStats.map((cat) => (
                <CategoryBar key={cat.id} category={cat} maxCount={maxCount} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
