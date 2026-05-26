"use client";

import { useEffect, useMemo, useState } from "react";
import { KnowledgeBaseApp } from "@/components/knowledge-base-app";
import type { Category } from "@/types/knowledge";

const LS_KEY = "dk:questionVisitCounts";

type VisitCounts = Record<string, number>;

function safeParseVisitCounts(raw: string | null): VisitCounts {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as VisitCounts;
    return {};
  } catch {
    return {};
  }
}

function filterTreeMostViewed(categories: Category[], visitCounts: VisitCounts): Category[] {
  const walk = (nodes: Category[]): Category[] => {
    return nodes
      .map((cat) => {
        const questions = cat.questions.filter((q) => (visitCounts[q.id] ?? 0) > 0);
        const children = walk(cat.children);
        if (questions.length === 0 && children.length === 0) return null;
        return {
          ...cat,
          questions,
          children
        };
      })
      .filter((x): x is Category => x !== null);
  };

  return walk(categories);
}

export function MostViewedClient({
  initialCategories,
  userEmail
}: {
  initialCategories: Category[];
  userEmail: string | null;
}) {
  const [filtered, setFiltered] = useState<Category[]>(initialCategories);

  useEffect(() => {
    const counts = safeParseVisitCounts(window.localStorage.getItem(LS_KEY));
    setFiltered(filterTreeMostViewed(initialCategories, counts));
  }, [initialCategories]);

  const emptyState = useMemo(() => filtered.length === 0, [filtered]);

  return (
    <div className="h-full">
      {emptyState ? (
        <KnowledgeBaseApp
          initialCategories={[]}
          userEmail={userEmail}
          workspaceTitle="Most Viewed"
          workspaceSubtitle="Most viewed notes"
          canCreateRootCategory={false}
        />
      ) : (
        <KnowledgeBaseApp
          initialCategories={filtered}
          userEmail={userEmail}
          workspaceTitle="Most Viewed"
          workspaceSubtitle="Most viewed notes"
          canCreateRootCategory={false}
        />
      )}
    </div>
  );
}

