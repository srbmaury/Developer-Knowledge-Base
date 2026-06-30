"use client";

import { useEffect, useState } from "react";
import { KnowledgeBaseApp } from "@/components/knowledge-base-app";
import type { Category } from "@/types/knowledge";

const LS_KEY = "dk:questionVisitCounts";
const VIRTUAL_CAT_ID = "__most-viewed__";

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

function buildMostViewedCategory(categories: Category[], visitCounts: VisitCounts): Category[] {
  const questions: Category["questions"] = [];

  const walk = (nodes: Category[]) => {
    for (const cat of nodes) {
      for (const q of cat.questions) {
        const visits = visitCounts[q.id] ?? 0;
        if (visits > 0) questions.push({ ...q, categoryId: VIRTUAL_CAT_ID });
      }
      walk(cat.children);
    }
  };
  walk(categories);

  if (questions.length === 0) return [];

  questions.sort((a, b) => (visitCounts[b.id] ?? 0) - (visitCounts[a.id] ?? 0));

  return [
    {
      id: VIRTUAL_CAT_ID,
      userId: categories[0]?.userId ?? "",
      name: "Most Viewed",
      isPublic: false,
      canEdit: false,
      parentId: null,
      order: 0,
      createdAt: new Date().toISOString(),
      children: [],
      questions
    }
  ];
}

export function MostViewedClient({
  initialCategories,
  userEmail
}: {
  initialCategories: Category[];
  userEmail: string | null;
}) {
  // Start with all categories so the server-rendered HTML matches the initial client render.
  // The effect below replaces this with the visit-count-filtered list after hydration.
  const [filtered, setFiltered] = useState<Category[]>(initialCategories);

  useEffect(() => {
    const counts = safeParseVisitCounts(window.localStorage.getItem(LS_KEY));
    setFiltered(buildMostViewedCategory(initialCategories, counts));
  }, [initialCategories]);

  return (
    <KnowledgeBaseApp
      initialCategories={filtered}
      userEmail={userEmail}
      workspaceTitle="Most Viewed"
      workspaceSubtitle="Most viewed notes"
      canCreateRootCategory={false}
      emptyMessage="Open some notes to see them here — visit counts are tracked in this browser."
    />
  );
}
