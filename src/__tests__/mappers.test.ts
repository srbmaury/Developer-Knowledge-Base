import { describe, expect, it } from "vitest";
import { buildCategoryTree, buildSlimCategoryTree, mapTag } from "@/lib/mappers";

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
  tags: { id: string; name: string; color: string }[];
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
    tags: [],
    ...overrides
  };
}

function makeRows(rows: MockRow[]) {
  return rows as unknown as Parameters<typeof buildCategoryTree>[0];
}

describe("mapTag", () => {
  it("passes through a valid tag color", () => {
    const tag = mapTag({ id: "t1", name: "arrays", color: "green" });
    expect(tag.color).toBe("green");
  });

  it("falls back to 'blue' for an unrecognised color", () => {
    const tag = mapTag({ id: "t1", name: "arrays", color: "chartreuse" });
    expect(tag.color).toBe("blue");
  });

  it("maps id and name unchanged", () => {
    const tag = mapTag({ id: "t42", name: "dp", color: "red" });
    expect(tag.id).toBe("t42");
    expect(tag.name).toBe("dp");
  });
});

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

// ── buildSlimCategoryTree ─────────────────────────────────────────────────────

type MockSlimSolution = {
  id: string;
  questionId: string;
  title: string;
  language: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
};

type MockSlimQuestion = {
  id: string;
  categoryId: string;
  title: string;
  description: string;
  difficulty: string;
  isFavorite: boolean;
  isPinned: boolean;
  order: number;
  status: string;
  srDue: Date | null;
  srInterval: number;
  srEase: number;
  srReviews: number;
  createdAt: Date;
  updatedAt: Date;
  solutions: MockSlimSolution[];
  tags: { id: string; name: string; color: string }[];
};

type MockSlimRow = {
  id: string;
  userId: string;
  name: string;
  isPublic: boolean;
  parentId: string | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  questions: MockSlimQuestion[];
};

function makeSlimRow(overrides: Partial<MockSlimRow> = {}): MockSlimRow {
  return {
    id: "cat-1", userId: "user-1", name: "My Category", isPublic: false,
    parentId: null, order: 0, createdAt: NOW, updatedAt: NOW, questions: [],
    ...overrides
  };
}

function makeSlimQuestion(overrides: Partial<MockSlimQuestion> = {}): MockSlimQuestion {
  return {
    id: "q-1", categoryId: "cat-1", title: "Q", description: "", difficulty: "MEDIUM",
    isFavorite: false, isPinned: false, order: 0,
    status: "active", srDue: null, srInterval: 1, srEase: 2.5, srReviews: 0,
    createdAt: NOW, updatedAt: NOW, solutions: [], tags: [],
    ...overrides
  };
}

function makeSlimRows(rows: MockSlimRow[]) {
  return rows as unknown as Parameters<typeof buildSlimCategoryTree>[0];
}

describe("buildSlimCategoryTree", () => {
  it("returns empty array for empty input", () => {
    expect(buildSlimCategoryTree(makeSlimRows([]), "user-1")).toEqual([]);
  });

  it("maps solution with content='', notes='', aiReview=null, contentLoaded=false", () => {
    const solution: MockSlimSolution = {
      id: "s1", questionId: "q-1", title: "Best Approach",
      language: "typescript", order: 0, createdAt: NOW, updatedAt: NOW
    };
    const row = makeSlimRow({ questions: [makeSlimQuestion({ solutions: [solution] })] });
    const result = buildSlimCategoryTree(makeSlimRows([row]), "user-1");
    const s = result[0].questions[0].solutions[0];
    expect(s.content).toBe("");
    expect(s.notes).toBe("");
    expect(s.aiReview).toBeNull();
    expect(s.contentLoaded).toBe(false);
  });

  it("sets canEdit=true when viewer owns the category", () => {
    const result = buildSlimCategoryTree(makeSlimRows([makeSlimRow({ userId: "user-1" })]), "user-1");
    expect(result[0].canEdit).toBe(true);
  });

  it("sets canEdit=false when viewer does not own the category", () => {
    const result = buildSlimCategoryTree(makeSlimRows([makeSlimRow({ userId: "user-1" })]), "user-2");
    expect(result[0].canEdit).toBe(false);
  });

  it("sets canEdit=false when viewerUserId is null", () => {
    const result = buildSlimCategoryTree(makeSlimRows([makeSlimRow()]), null);
    expect(result[0].canEdit).toBe(false);
  });

  it("builds nested tree from parentId references", () => {
    const parent = makeSlimRow({ id: "parent", parentId: null });
    const child = makeSlimRow({ id: "child", parentId: "parent" });
    const result = buildSlimCategoryTree(makeSlimRows([parent, child]), "user-1");
    expect(result).toHaveLength(1);
    expect(result[0].children[0].id).toBe("child");
  });

  it("treats a row with an unknown parentId as a root", () => {
    const orphan = makeSlimRow({ id: "orphan", parentId: "missing" });
    const result = buildSlimCategoryTree(makeSlimRows([orphan]), "user-1");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("orphan");
  });

  it("sorts root categories by order ascending", () => {
    const rows = [
      makeSlimRow({ id: "c", order: 2 }),
      makeSlimRow({ id: "a", order: 0 }),
      makeSlimRow({ id: "b", order: 1 }),
    ];
    const result = buildSlimCategoryTree(makeSlimRows(rows), "user-1");
    expect(result.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("sorts questions: pinned first, then by order ascending", () => {
    const questions = [
      makeSlimQuestion({ id: "q1", isPinned: false, order: 0 }),
      makeSlimQuestion({ id: "q2", isPinned: true, order: 5 }),
      makeSlimQuestion({ id: "q3", isPinned: false, order: 1 }),
    ];
    const result = buildSlimCategoryTree(makeSlimRows([makeSlimRow({ questions })]), "user-1");
    expect(result[0].questions.map((q) => q.id)).toEqual(["q2", "q1", "q3"]);
  });

  it("sorts solutions within a question by order ascending", () => {
    const solutions: MockSlimSolution[] = [
      { id: "s2", questionId: "q-1", title: "", language: "typescript", order: 2, createdAt: NOW, updatedAt: NOW },
      { id: "s0", questionId: "q-1", title: "", language: "typescript", order: 0, createdAt: NOW, updatedAt: NOW },
    ];
    const result = buildSlimCategoryTree(
      makeSlimRows([makeSlimRow({ questions: [makeSlimQuestion({ solutions })] })]),
      "user-1"
    );
    expect(result[0].questions[0].solutions.map((s) => s.id)).toEqual(["s0", "s2"]);
  });

  it("converts srDue Date to ISO string, null stays null", () => {
    const dueDate = new Date("2025-06-01T04:00:00.000Z");
    const withDue = makeSlimQuestion({ id: "q-due", srDue: dueDate });
    const noDue = makeSlimQuestion({ id: "q-null", srDue: null });
    const result = buildSlimCategoryTree(
      makeSlimRows([makeSlimRow({ questions: [withDue, noDue] })]),
      "user-1"
    );
    const qs = result[0].questions;
    expect(qs.find((q) => q.id === "q-due")!.srDue).toBe(dueDate.toISOString());
    expect(qs.find((q) => q.id === "q-null")!.srDue).toBeNull();
  });
});
