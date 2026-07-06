"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/server/auth";
import type { Difficulty } from "@/types/knowledge";
import { revalidateWorkspace, unauthorized } from "./shared";

export async function getExportContentAction(): Promise<
  { ok: true; content: Record<string, string> } | { ok: false; message: string }
> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return unauthorized();
  }

  // Fetch first solution content per question — workspace loads slim data without content
  const solutions = await prisma.solution.findMany({
    where: { question: { category: { userId } } },
    select: { questionId: true, content: true, order: true },
    orderBy: { order: "asc" },
  });

  const content: Record<string, string> = {};
  for (const s of solutions) {
    if (!(s.questionId in content)) content[s.questionId] = s.content;
  }

  return { ok: true, content };
}

type ImportQuestion = {
  title: string;
  description: string;
  difficulty: Difficulty | null;
  content: string;
  tagNames: string[];
};

type ImportNode = {
  name: string;
  questions: ImportQuestion[];
  children: ImportNode[];
};

export async function bulkImportAction(nodes: ImportNode[]): Promise<
  { ok: true; categories: number; questions: number } | { ok: false; message: string }
> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return unauthorized();
  }

  function countNodes(ns: ImportNode[]): { cats: number; qs: number } {
    return ns.reduce(
      (acc, n) => {
        const sub = countNodes(n.children);
        return { cats: acc.cats + 1 + sub.cats, qs: acc.qs + n.questions.length + sub.qs };
      },
      { cats: 0, qs: 0 }
    );
  }
  const { cats, qs } = countNodes(nodes);
  if (cats === 0 && qs === 0) return { ok: false as const, message: "Nothing to import." };
  if (cats > 500) return { ok: false as const, message: "Import too large — max 500 categories." };
  if (qs > 2000) return { ok: false as const, message: "Import too large — max 2000 questions." };

  function collectTagNames(ns: ImportNode[], acc = new Set<string>()) {
    for (const n of ns) {
      for (const q of n.questions) for (const t of q.tagNames) if (t) acc.add(t);
      collectTagNames(n.children, acc);
    }
    return acc;
  }
  const allTagNames = [...collectTagNames(nodes)];

  // Pre-fetch existing data outside any transaction — avoids long-held connections
  const { randomUUID } = await import("node:crypto");
  const [existingTags, existingCats] = await Promise.all([
    prisma.tag.findMany({ where: { userId }, select: { id: true, name: true } }),
    prisma.category.findMany({
      where: { userId },
      select: { id: true, name: true, parentId: true, _count: { select: { questions: true, children: true } } },
    }),
  ]);

  // Tag map: lowercase name → id
  const tagMap = new Map<string, string>();
  for (const t of existingTags) tagMap.set(t.name.toLowerCase(), t.id);

  // Category map: "${parentId ?? '__root__'}/${name}" → { id, questionCount, childCount }
  type CatMeta = { id: string; questionCount: number; childCount: number };
  const catKey = (parentId: string | null, name: string) => `${parentId ?? "__root__"}/${name}`;
  const catMap = new Map<string, CatMeta>();
  for (const c of existingCats) {
    catMap.set(catKey(c.parentId, c.name), {
      id: c.id,
      questionCount: c._count.questions,
      childCount: c._count.children,
    });
  }
  const existingRootCount = existingCats.filter((c) => c.parentId === null).length;

  // Build the full list of Prisma operations with pre-generated IDs — no awaits needed
  const ops: Prisma.PrismaPromise<unknown>[] = [];

  // Create missing tags
  for (const name of allTagNames) {
    const key = name.toLowerCase();
    if (!tagMap.has(key)) {
      const id = randomUUID();
      tagMap.set(key, id);
      ops.push(prisma.tag.create({ data: { id, userId, name } }));
    }
  }

  function processNode(node: ImportNode, parentId: string | null, siblingIdx: number) {
    const key = catKey(parentId, node.name);
    const existing = catMap.get(key);

    let categoryId: string;
    let existingQCount = 0;
    let existingChildCount = 0;

    if (existing) {
      categoryId = existing.id;
      existingQCount = existing.questionCount;
      existingChildCount = existing.childCount;
    } else {
      categoryId = randomUUID();
      const order = parentId === null ? existingRootCount + siblingIdx : siblingIdx;
      ops.push(prisma.category.create({ data: { id: categoryId, userId, name: node.name, parentId, order } }));
      // Register so nested children can find this category by name
      catMap.set(key, { id: categoryId, questionCount: 0, childCount: 0 });
    }

    for (let i = 0; i < node.questions.length; i++) {
      const q = node.questions[i];
      const questionId = randomUUID();
      const tagIds = q.tagNames
        .map((n) => tagMap.get(n.toLowerCase()))
        .filter((id): id is string => id !== undefined);

      ops.push(
        prisma.question.create({
          data: {
            id: questionId,
            categoryId,
            title: q.title || "Untitled",
            description: q.description,
            difficulty: q.difficulty ?? "MEDIUM",
            order: existingQCount + i,
          },
        })
      );

      // Separate update so tag connects run after both the question and the tags are inserted
      if (tagIds.length > 0) {
        ops.push(
          prisma.question.update({
            where: { id: questionId },
            data: { tags: { connect: tagIds.map((id) => ({ id })) } },
          })
        );
      }

      ops.push(
        prisma.solution.create({
          data: {
            id: randomUUID(),
            questionId,
            title: "Best Approach",
            language: "typescript",
            content: q.content,
            notes: "",
            order: 0,
          },
        })
      );
    }

    for (let i = 0; i < node.children.length; i++) {
      processNode(node.children[i], categoryId, existingChildCount + i);
    }
  }

  for (let i = 0; i < nodes.length; i++) {
    processNode(nodes[i], null, i);
  }

  // Fire all operations in a single batch transaction — no long-held connection needed
  await prisma.$transaction(ops);

  revalidateWorkspace(userId);
  return { ok: true as const, categories: cats, questions: qs };
}
