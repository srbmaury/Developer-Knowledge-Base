import { describe, expect, it } from "vitest";
import { buildCategoryTree } from "@/lib/mappers";

const NOW = new Date();

type MockSolution = {
  id: string;
  questionId: string;
  title: string;
  language: string;
  content: string;
  notes: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
};

type MockQuestion = {
  id: string;
  categoryId: string;
  title: string;
  description: string;
  difficulty: string;
  isFavorite: boolean;
  isPinned: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  solutions: MockSolution[];
};

type MockRow = {
  id: string;
  userId: string;
  name: string;
  isPublic: boolean;
  parentId: string | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  questions: MockQuestion[];
};

function makeRow(overrides: Partial<MockRow> = {}): MockRow {
  return {
    id: "cat-1",
    userId: "user-1",
    name: "My Category",
    isPublic: false,
    parentId: null,
    order: 0,
    createdAt: NOW,
    updatedAt: NOW,
    questions: [],
    ...overrides
  };
}

function makeQuestion(overrides: Partial<MockQuestion> = {}): MockQuestion {
  return {
    id: "q-1",
    categoryId: "cat-1",
    title: "Question title",
    description: "",
    difficulty: "MEDIUM",
    isFavorite: false,
    isPinned: false,
    order: 0,
    createdAt: NOW,
    updatedAt: NOW,
    solutions: [],
    ...overrides
  };
}

function makeRows(rows: MockRow[]) {
  return rows as unknown as Parameters<typeof buildCategoryTree>[0];
}

describe("buildCategoryTree", () => {
  it("returns empty array for empty input", () => {
    expect(buildCategoryTree(makeRows([]), "user-1")).toEqual([]);
  });

  it("maps a single flat row to a root category", () => {
    const result = buildCategoryTree(makeRows([makeRow()]), "user-1");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("cat-1");
    expect(result[0].name).toBe("My Category");
    expect(result[0].parentId).toBeNull();
    expect(result[0].children).toEqual([]);
  });

  it("converts createdAt Date to ISO string", () => {
    const result = buildCategoryTree(makeRows([makeRow()]), "user-1");
    expect(result[0].createdAt).toBe(NOW.toISOString());
  });

  it("sets canEdit = true when viewerUserId matches the category's userId", () => {
    const result = buildCategoryTree(makeRows([makeRow({ userId: "user-1" })]), "user-1");
    expect(result[0].canEdit).toBe(true);
  });

  it("sets canEdit = false when viewerUserId does not match", () => {
    const result = buildCategoryTree(makeRows([makeRow({ userId: "user-1" })]), "user-2");
    expect(result[0].canEdit).toBe(false);
  });

  it("sets canEdit = false when viewerUserId is null (unauthenticated)", () => {
    const result = buildCategoryTree(makeRows([makeRow()]), null);
    expect(result[0].canEdit).toBe(false);
  });

  it("builds parent-child relationships from parentId", () => {
    const parent = makeRow({ id: "parent", parentId: null, order: 0 });
    const child = makeRow({ id: "child", parentId: "parent", order: 0 });
    const result = buildCategoryTree(makeRows([parent, child]), "user-1");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("parent");
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children[0].id).toBe("child");
  });

  it("treats a child whose parentId is not in the rows as a root", () => {
    const orphan = makeRow({ id: "orphan", parentId: "nonexistent", order: 0 });
    const result = buildCategoryTree(makeRows([orphan]), "user-1");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("orphan");
  });

  it("sorts root categories by order ascending", () => {
    const b = makeRow({ id: "b", order: 2 });
    const a = makeRow({ id: "a", order: 0 });
    const c = makeRow({ id: "c", order: 1 });

    const result = buildCategoryTree(makeRows([b, a, c]), "user-1");
    expect(result.map((r) => r.id)).toEqual(["a", "c", "b"]);
  });

  it("sorts children by order ascending", () => {
    const parent = makeRow({ id: "p", order: 0 });
    const child2 = makeRow({ id: "c2", parentId: "p", order: 2 });
    const child0 = makeRow({ id: "c0", parentId: "p", order: 0 });
    const child1 = makeRow({ id: "c1", parentId: "p", order: 1 });

    const result = buildCategoryTree(makeRows([parent, child2, child0, child1]), "user-1");
    expect(result[0].children.map((c) => c.id)).toEqual(["c0", "c1", "c2"]);
  });

  it("sorts questions within a category: pinned first, then by order", () => {
    const q1 = makeQuestion({ id: "q1", isPinned: false, order: 0 });
    const q2 = makeQuestion({ id: "q2", isPinned: true, order: 5 });
    const q3 = makeQuestion({ id: "q3", isPinned: false, order: 1 });
    const row = makeRow({ questions: [q1, q2, q3] });

    const result = buildCategoryTree(makeRows([row]), "user-1");
    expect(result[0].questions.map((q) => q.id)).toEqual(["q2", "q1", "q3"]);
  });

  it("sorts solutions within a question by order ascending", () => {
    const solutions = [
      { id: "s2", questionId: "q-1", title: "", language: "typescript", content: "", notes: "", order: 2, createdAt: NOW, updatedAt: NOW },
      { id: "s0", questionId: "q-1", title: "", language: "typescript", content: "", notes: "", order: 0, createdAt: NOW, updatedAt: NOW },
      { id: "s1", questionId: "q-1", title: "", language: "typescript", content: "", notes: "", order: 1, createdAt: NOW, updatedAt: NOW }
    ];
    const row = makeRow({ questions: [makeQuestion({ solutions })] });

    const result = buildCategoryTree(makeRows([row]), "user-1");
    expect(result[0].questions[0].solutions.map((s) => s.id)).toEqual(["s0", "s1", "s2"]);
  });

  it("normalises unknown solution language to typescript", () => {
    const solution = {
      id: "s1", questionId: "q-1", title: "", language: "cobol", content: "", notes: "",
      order: 0, createdAt: NOW, updatedAt: NOW
    };
    const row = makeRow({ questions: [makeQuestion({ solutions: [solution] })] });

    const result = buildCategoryTree(makeRows([row]), "user-1");
    expect(result[0].questions[0].solutions[0].language).toBe("typescript");
  });
});
