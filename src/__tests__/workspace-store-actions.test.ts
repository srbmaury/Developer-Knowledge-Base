/**
 * Tests for store actions not covered by workspace-store.test.ts:
 * async actions (addCategory, addQuestion, addSolution, deleteSolution,
 * fetchSolutionContent, createTag), remaining sync actions, and exported helpers.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── mocks ─────────────────────────────────────────────────────────────────────

const mockSync = {
  deleteQuestion: vi.fn().mockResolvedValue({ ok: true }),
  createQuestion: vi.fn().mockResolvedValue({ ok: true, question: { id: "real-q", solutionId: "real-sol" } }),
  createSolution: vi.fn().mockResolvedValue({ ok: true, id: "real-sol-id" }),
  updateSolution: vi.fn().mockResolvedValue({ ok: true }),
  updateQuestion: vi.fn().mockResolvedValue({ ok: true }),
  updateCategory: vi.fn(),
  updateCategoryVisibility: vi.fn(),
  createCategory: vi.fn().mockResolvedValue({ ok: true, id: "real-cat-id" }),
  deleteCategory: vi.fn(),
  deleteSolution: vi.fn().mockResolvedValue({ ok: true }),
  reorderCategories: vi.fn(),
  reorderQuestions: vi.fn(),
  createTag: vi.fn().mockResolvedValue({ ok: true, id: "real-tag-id" }),
  deleteTag: vi.fn(),
  addTagToQuestion: vi.fn(),
  removeTagFromQuestion: vi.fn(),
  getSolutionContent: vi.fn().mockResolvedValue({ ok: true, content: "fetched code", notes: "fetched notes", aiReview: null }),
  updateQuestionStatus: vi.fn(),
  submitSpacedReview: vi.fn().mockResolvedValue({ ok: true, next: { due: new Date().toISOString(), interval: 6, ease: 2.5, reviews: 2 } }),
  enrollInReview: vi.fn(),
  unenrollFromReview: vi.fn(),
  moveQuestion: vi.fn(),
  bulkSave: vi.fn().mockResolvedValue({ ok: true }),
};

vi.mock("@/lib/workspace-sync", () => ({ workspaceSync: mockSync }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() } }));

const lsStore: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (k: string) => lsStore[k] ?? null,
  setItem: (k: string, v: string) => { lsStore[k] = v; },
  removeItem: (k: string) => { delete lsStore[k]; },
});

// ── helpers ───────────────────────────────────────────────────────────────────

import type { Category, Question, Tag } from "@/types/knowledge";

const NOW = new Date().toISOString();

function makeSolution(id: string, questionId: string, order = 0, opts?: { language?: "none" | "java" | "cpp" | "javascript" | "typescript" | "python" | "sql" }) {
  return {
    id, questionId, title: "Best Approach", language: opts?.language ?? "typescript",
    content: "", notes: "", aiReview: null, contentLoaded: false, order,
    createdAt: NOW, updatedAt: NOW,
  };
}

function makeQuestion(id: string, categoryId: string, order = 0, opts?: {
  isPinned?: boolean; isFavorite?: boolean; solutions?: ReturnType<typeof makeSolution>[];
  tags?: Tag[];
}): Question {
  return {
    id, categoryId, title: `Q-${id}`, description: "", difficulty: "MEDIUM" as const,
    isFavorite: opts?.isFavorite ?? false, isPinned: opts?.isPinned ?? false, order,
    createdAt: NOW, updatedAt: NOW,
    solutions: opts?.solutions ?? [makeSolution(`sol-${id}`, id)],
    tags: opts?.tags ?? [],
    status: "NOT_STARTED" as const, srDue: null, srInterval: 1, srEase: 2.5, srReviews: 0,
  };
}

function makeCategory(id: string, opts?: {
  questions?: ReturnType<typeof makeQuestion>[];
  children?: Category[];
  canEdit?: boolean;
  order?: number;
}): Category {
  return {
    id, userId: "user-1", name: `Cat-${id}`, isPublic: false,
    canEdit: opts?.canEdit ?? true, parentId: null, order: opts?.order ?? 0,
    createdAt: NOW, children: opts?.children ?? [], questions: opts?.questions ?? [],
  };
}

async function getStore() {
  const { useWorkspaceStore } = await import("@/store/workspace-store");
  return useWorkspaceStore;
}

beforeEach(async () => {
  for (const key of Object.keys(lsStore)) delete lsStore[key];
  vi.clearAllMocks();
  // Restore default mock behaviours
  mockSync.createCategory.mockResolvedValue({ ok: true, id: "real-cat-id" });
  mockSync.createQuestion.mockResolvedValue({ ok: true, question: { id: "real-q", solutionId: "real-sol" } });
  mockSync.createSolution.mockResolvedValue({ ok: true, id: "real-sol-id" });
  mockSync.deleteSolution.mockResolvedValue({ ok: true });
  mockSync.getSolutionContent.mockResolvedValue({ ok: true, content: "fetched code", notes: "fetched notes", aiReview: null });
  mockSync.createTag.mockResolvedValue({ ok: true, id: "real-tag-id" });
  mockSync.submitSpacedReview.mockResolvedValue({ ok: true, next: { due: new Date().toISOString(), interval: 6, ease: 2.5, reviews: 2 } });

  const { useWorkspaceStore } = await import("@/store/workspace-store");
  useWorkspaceStore.setState({
    categories: [], selectedCategoryId: null, selectedQuestionId: null,
    selectedSolutionId: null, expandedCategoryIds: [],
    questionById: new Map(), questionIdToCategoryId: new Map(),
    solutionIdToLocation: new Map(), allTags: [], filterTagIds: [],
    filterStatus: null, searchIndex: null, defaultLanguage: "typescript",
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// simple setters
// ─────────────────────────────────────────────────────────────────────────────

describe("setQuery / setCommandOpen / setShortcutsOpen / selectSolution", () => {
  it("setQuery updates query", async () => {
    const s = await getStore();
    s.getState().setQuery("binary search");
    expect(s.getState().query).toBe("binary search");
  });

  it("setCommandOpen updates commandOpen", async () => {
    const s = await getStore();
    s.getState().setCommandOpen(true);
    expect(s.getState().commandOpen).toBe(true);
  });

  it("setShortcutsOpen updates shortcutsOpen", async () => {
    const s = await getStore();
    s.getState().setShortcutsOpen(true);
    expect(s.getState().shortcutsOpen).toBe(true);
  });

  it("selectSolution updates selectedSolutionId", async () => {
    const s = await getStore();
    s.getState().selectSolution("sol-abc");
    expect(s.getState().selectedSolutionId).toBe("sol-abc");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateCategoryName / updateCategoryVisibility
// ─────────────────────────────────────────────────────────────────────────────

describe("updateCategoryName", () => {
  it("renames the category", async () => {
    const s = await getStore();
    s.getState().setInitialData([makeCategory("cat-a")]);
    s.getState().updateCategoryName("cat-a", "Renamed");
    expect(s.getState().categories[0].name).toBe("Renamed");
  });

  it("does nothing for a non-editable category", async () => {
    const s = await getStore();
    s.getState().setInitialData([makeCategory("cat-a", { canEdit: false })]);
    s.getState().updateCategoryName("cat-a", "Ignored");
    expect(s.getState().categories[0].name).toBe("Cat-cat-a");
  });

  it("skips the server save when the id is a temp id", async () => {
    const s = await getStore();
    s.getState().setInitialData([makeCategory("cat-a")]);
    s.setState({ categories: [{ ...s.getState().categories[0], id: "temp-cat-xyz" }] });
    s.getState().updateCategoryName("temp-cat-xyz", "Still Temp");
    expect(mockSync.updateCategory).not.toHaveBeenCalled();
  });
});

describe("updateCategoryVisibility", () => {
  it("flips isPublic for an editable category", async () => {
    const s = await getStore();
    s.getState().setInitialData([makeCategory("cat-a")]);
    s.getState().updateCategoryVisibility("cat-a", true);
    expect(s.getState().categories[0].isPublic).toBe(true);
  });

  it("does nothing for a non-editable category", async () => {
    const s = await getStore();
    s.getState().setInitialData([makeCategory("cat-a", { canEdit: false })]);
    s.getState().updateCategoryVisibility("cat-a", true);
    expect(s.getState().categories[0].isPublic).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// deleteCategory
// ─────────────────────────────────────────────────────────────────────────────

describe("deleteCategory", () => {
  it("removes the category from the tree", async () => {
    const s = await getStore();
    const catA = makeCategory("cat-a", { questions: [makeQuestion("q1", "cat-a")] });
    const catB = makeCategory("cat-b");
    s.getState().setInitialData([catA, catB]);

    s.getState().deleteCategory("cat-a");

    expect(s.getState().categories.map((c) => c.id)).toEqual(["cat-b"]);
  });

  it("does nothing if the category is not editable", async () => {
    const s = await getStore();
    s.getState().setInitialData([makeCategory("cat-a", { canEdit: false })]);
    s.getState().deleteCategory("cat-a");
    expect(s.getState().categories).toHaveLength(1);
  });

  it("clears the selected question when it lives in the deleted category", async () => {
    const s = await getStore();
    const catA = makeCategory("cat-a", { questions: [makeQuestion("q1", "cat-a")] });
    const catB = makeCategory("cat-b");
    s.getState().setInitialData([catA, catB]);
    s.setState({ selectedCategoryId: "cat-a", selectedQuestionId: "q1" });

    s.getState().deleteCategory("cat-a");

    expect(s.getState().selectedQuestionId).toBeNull();
  });

  it("removes expanded IDs that belonged to the deleted subtree", async () => {
    const s = await getStore();
    const catA = makeCategory("cat-a");
    s.getState().setInitialData([catA]);
    s.setState({ expandedCategoryIds: ["cat-a", "cat-b"] });

    s.getState().deleteCategory("cat-a");

    expect(s.getState().expandedCategoryIds).not.toContain("cat-a");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// addCategory (async)
// ─────────────────────────────────────────────────────────────────────────────

describe("addCategory", () => {
  it("adds an optimistic category then replaces with the real ID", async () => {
    const s = await getStore();
    s.getState().setInitialData([]);

    await s.getState().addCategory("New Cat");

    const ids = s.getState().categories.map((c) => c.id);
    expect(ids).toContain("real-cat-id");
    expect(ids.some((id) => id.startsWith("temp-"))).toBe(false);
  });

  it("removes the optimistic category on server error", async () => {
    const s = await getStore();
    mockSync.createCategory.mockResolvedValueOnce({ ok: false, message: "Server error" });
    s.getState().setInitialData([]);

    await s.getState().addCategory("Bad Cat");

    expect(s.getState().categories).toHaveLength(0);
  });

  it("adds a child category under its parent", async () => {
    const s = await getStore();
    s.getState().setInitialData([makeCategory("parent")]);

    await s.getState().addCategory("Child", "parent");

    const parent = s.getState().categories.find((c) => c.id === "parent");
    expect(parent?.children.some((c) => c.id === "real-cat-id")).toBe(true);
  });

  it("does nothing when parent does not exist or is not editable", async () => {
    const s = await getStore();
    s.getState().setInitialData([makeCategory("parent", { canEdit: false })]);
    await s.getState().addCategory("Child", "parent");
    const parent = s.getState().categories[0];
    expect(parent.children).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// addQuestion (async)
// ─────────────────────────────────────────────────────────────────────────────

describe("addQuestion", () => {
  it("adds question optimistically then replaces temp ID with real ID", async () => {
    const s = await getStore();
    s.getState().setInitialData([makeCategory("cat-a")]);

    await s.getState().addQuestion("cat-a", "New Q");

    const questions = s.getState().categories[0].questions;
    expect(questions).toHaveLength(1);
    expect(questions[0].id).toBe("real-q");
    expect(questions[0].id.startsWith("temp-")).toBe(false);
  });

  it("removes optimistic question on server error", async () => {
    const s = await getStore();
    mockSync.createQuestion.mockResolvedValueOnce({ ok: false, message: "Error" });
    s.getState().setInitialData([makeCategory("cat-a")]);

    await s.getState().addQuestion("cat-a", "Bad Q");

    expect(s.getState().categories[0].questions).toHaveLength(0);
  });

  it("does nothing for a non-editable category", async () => {
    const s = await getStore();
    s.getState().setInitialData([makeCategory("cat-a", { canEdit: false })]);
    await s.getState().addQuestion("cat-a", "Q");
    expect(s.getState().categories[0].questions).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// addSolution (async)
// ─────────────────────────────────────────────────────────────────────────────

describe("addSolution", () => {
  it("adds a solution optimistically then replaces temp ID", async () => {
    const s = await getStore();
    s.getState().setInitialData([makeCategory("cat-a", { questions: [makeQuestion("q1", "cat-a")] })]);

    await s.getState().addSolution("q1", "New Approach");

    const solutions = s.getState().categories[0].questions[0].solutions;
    expect(solutions).toHaveLength(2);
    expect(solutions[1].id).toBe("real-sol-id");
  });

  it("inherits the selected solution language", async () => {
    const s = await getStore();
    const question = makeQuestion("q1", "cat-a", 0, {
      solutions: [
        makeSolution("s1", "q1", 0, { language: "java" }),
        makeSolution("s2", "q1", 1, { language: "python" })
      ]
    });
    s.getState().setInitialData([makeCategory("cat-a", { questions: [question] })]);
    s.getState().selectSolution("s1");

    await s.getState().addSolution("q1", "Follow-up");

    const solutions = s.getState().categories[0].questions[0].solutions;
    expect(solutions[2].language).toBe("java");
    expect(mockSync.createSolution).toHaveBeenCalledWith("q1", "Follow-up", "java");
  });

  it("removes the optimistic solution on server error", async () => {
    const s = await getStore();
    mockSync.createSolution.mockResolvedValueOnce({ ok: false });
    s.getState().setInitialData([makeCategory("cat-a", { questions: [makeQuestion("q1", "cat-a")] })]);

    await s.getState().addSolution("q1", "Bad");

    const solutions = s.getState().categories[0].questions[0].solutions;
    expect(solutions).toHaveLength(1); // only the original
  });

  it("does nothing for a non-editable question", async () => {
    const s = await getStore();
    s.getState().setInitialData([makeCategory("cat-a", {
      questions: [makeQuestion("q1", "cat-a")], canEdit: false,
    })]);
    await s.getState().addSolution("q1", "S");
    expect(s.getState().categories[0].questions[0].solutions).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// deleteSolution (async)
// ─────────────────────────────────────────────────────────────────────────────

describe("deleteSolution", () => {
  it("removes the solution from the question", async () => {
    const s = await getStore();
    const q = makeQuestion("q1", "cat-a", 0, {
      solutions: [makeSolution("s1", "q1", 0), makeSolution("s2", "q1", 1)],
    });
    s.getState().setInitialData([makeCategory("cat-a", { questions: [q] })]);

    await s.getState().deleteSolution("s1");

    const solutions = s.getState().categories[0].questions[0].solutions;
    expect(solutions.map((x) => x.id)).toEqual(["s2"]);
  });

  it("rejects deletion when only one solution remains", async () => {
    const s = await getStore();
    s.getState().setInitialData([makeCategory("cat-a", { questions: [makeQuestion("q1", "cat-a")] })]);
    await s.getState().deleteSolution("sol-q1");

    // Question still has its one solution
    expect(s.getState().categories[0].questions[0].solutions).toHaveLength(1);
  });

  it("does nothing when the solution is not editable", async () => {
    const s = await getStore();
    const q = makeQuestion("q1", "cat-a", 0, {
      solutions: [makeSolution("s1", "q1", 0), makeSolution("s2", "q1", 1)],
    });
    s.getState().setInitialData([makeCategory("cat-a", { questions: [q], canEdit: false })]);
    await s.getState().deleteSolution("s1");
    expect(s.getState().categories[0].questions[0].solutions).toHaveLength(2);
  });

  it("selects the remaining solution when the selected solution is deleted", async () => {
    const s = await getStore();
    const q = makeQuestion("q1", "cat-a", 0, {
      solutions: [makeSolution("s1", "q1", 0), makeSolution("s2", "q1", 1)],
    });
    s.getState().setInitialData([makeCategory("cat-a", { questions: [q] })]);
    s.setState({ selectedSolutionId: "s1" });

    await s.getState().deleteSolution("s1");

    expect(s.getState().selectedSolutionId).toBe("s2");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// fetchSolutionContent (async)
// ─────────────────────────────────────────────────────────────────────────────

describe("fetchSolutionContent", () => {
  it("updates content, notes, and contentLoaded in the tree", async () => {
    const s = await getStore();
    s.getState().setInitialData([makeCategory("cat-a", { questions: [makeQuestion("q1", "cat-a")] })]);

    await s.getState().fetchSolutionContent("sol-q1");

    const sol = s.getState().categories[0].questions[0].solutions[0];
    expect(sol.content).toBe("fetched code");
    expect(sol.notes).toBe("fetched notes");
    expect(sol.contentLoaded).toBe(true);
  });

  it("does nothing on server error", async () => {
    const s = await getStore();
    // contentLoaded: true prevents setInitialData from auto-fetching
    const q = makeQuestion("q1", "cat-a", 0, {
      solutions: [{ ...makeSolution("sol-q1", "q1"), contentLoaded: true }],
    });
    s.getState().setInitialData([makeCategory("cat-a", { questions: [q] })]);
    mockSync.getSolutionContent.mockResolvedValueOnce({ ok: false });

    await s.getState().fetchSolutionContent("sol-q1");

    const sol = s.getState().categories[0].questions[0].solutions[0];
    expect(sol.content).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateSolutionAiReview
// ─────────────────────────────────────────────────────────────────────────────

describe("updateSolutionAiReview", () => {
  it("sets the AI review on the solution", async () => {
    const s = await getStore();
    s.getState().setInitialData([makeCategory("cat-a", { questions: [makeQuestion("q1", "cat-a")] })]);

    const review = { summary: "Good", time: "O(n)", space: "O(1)", tips: [] } as unknown as import("@/lib/ai-answer").ReviewResult;
    s.getState().updateSolutionAiReview("sol-q1", review);

    expect(s.getState().categories[0].questions[0].solutions[0].aiReview).toEqual(review);
  });

  it("clears the review when null is passed", async () => {
    const s = await getStore();
    s.getState().setInitialData([makeCategory("cat-a", { questions: [makeQuestion("q1", "cat-a")] })]);
    s.getState().updateSolutionAiReview("sol-q1", null);
    expect(s.getState().categories[0].questions[0].solutions[0].aiReview).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateQuestionStatus
// ─────────────────────────────────────────────────────────────────────────────

describe("updateQuestionStatus", () => {
  it("updates status to SOLVED", async () => {
    const s = await getStore();
    s.getState().setInitialData([makeCategory("cat-a", { questions: [makeQuestion("q1", "cat-a")] })]);
    s.getState().updateQuestionStatus("q1", "SOLVED");
    expect(s.getState().categories[0].questions[0].status).toBe("SOLVED");
  });

  it("does nothing for a non-editable category", async () => {
    const s = await getStore();
    s.getState().setInitialData([makeCategory("cat-a", { questions: [makeQuestion("q1", "cat-a")], canEdit: false })]);
    s.getState().updateQuestionStatus("q1", "SOLVED");
    expect(s.getState().categories[0].questions[0].status).toBe("NOT_STARTED");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// enrollInReview / unenrollFromReview
// ─────────────────────────────────────────────────────────────────────────────

describe("enrollInReview", () => {
  it("sets a non-null srDue on the question", async () => {
    const s = await getStore();
    s.getState().setInitialData([makeCategory("cat-a", { questions: [makeQuestion("q1", "cat-a")] })]);
    s.getState().enrollInReview("q1");
    expect(s.getState().categories[0].questions[0].srDue).not.toBeNull();
  });
});

describe("unenrollFromReview", () => {
  it("resets all spaced-repetition fields to defaults", async () => {
    const s = await getStore();
    const q = { ...makeQuestion("q1", "cat-a"), srDue: new Date().toISOString(), srInterval: 10, srEase: 3, srReviews: 5 };
    s.getState().setInitialData([makeCategory("cat-a", { questions: [q] })]);

    s.getState().unenrollFromReview("q1");

    const updated = s.getState().categories[0].questions[0];
    expect(updated.srDue).toBeNull();
    expect(updated.srInterval).toBe(1);
    expect(updated.srEase).toBe(2.5);
    expect(updated.srReviews).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// submitSpacedReview (async)
// ─────────────────────────────────────────────────────────────────────────────

describe("submitSpacedReview", () => {
  it("updates SR fields when server responds successfully", async () => {
    const s = await getStore();
    const due = "2099-01-01T04:00:00.000Z";
    mockSync.submitSpacedReview.mockResolvedValueOnce({
      ok: true, next: { due, interval: 15, ease: 2.6, reviews: 3 },
    });
    s.getState().setInitialData([makeCategory("cat-a", { questions: [makeQuestion("q1", "cat-a")] })]);

    s.getState().submitSpacedReview("q1", "good");
    await Promise.resolve(); // flush the .then()

    const q = s.getState().categories[0].questions[0];
    expect(q.srDue).toBe(due);
    expect(q.srInterval).toBe(15);
    expect(q.srReviews).toBe(3);
  });

  it("does nothing for a non-editable question", async () => {
    const s = await getStore();
    s.getState().setInitialData([makeCategory("cat-a", {
      questions: [makeQuestion("q1", "cat-a")], canEdit: false,
    })]);
    s.getState().submitSpacedReview("q1", "good");
    expect(mockSync.submitSpacedReview).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// moveQuestion
// ─────────────────────────────────────────────────────────────────────────────

describe("moveQuestion", () => {
  it("moves a question to a different category", async () => {
    const s = await getStore();
    const catA = makeCategory("cat-a", { questions: [makeQuestion("q1", "cat-a")] });
    const catB = makeCategory("cat-b");
    s.getState().setInitialData([catA, catB]);

    s.getState().moveQuestion("q1", "cat-b");

    expect(s.getState().categories[0].questions).toHaveLength(0); // cat-a empty
    expect(s.getState().categories[1].questions[0].id).toBe("q1");
    expect(s.getState().selectedCategoryId).toBe("cat-b");
  });

  it("does nothing when src and target are the same category", async () => {
    const s = await getStore();
    const catA = makeCategory("cat-a", { questions: [makeQuestion("q1", "cat-a")] });
    s.getState().setInitialData([catA]);
    s.getState().moveQuestion("q1", "cat-a");
    expect(s.getState().categories[0].questions).toHaveLength(1);
  });

  it("does nothing when source category is not editable", async () => {
    const s = await getStore();
    const catA = makeCategory("cat-a", { questions: [makeQuestion("q1", "cat-a")], canEdit: false });
    const catB = makeCategory("cat-b");
    s.getState().setInitialData([catA, catB]);
    s.getState().moveQuestion("q1", "cat-b");
    expect(s.getState().categories[0].questions).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// reorderCategories
// ─────────────────────────────────────────────────────────────────────────────

describe("reorderCategories", () => {
  it("reorders root categories", async () => {
    const s = await getStore();
    const catA = makeCategory("cat-a", { order: 0 });
    const catB = makeCategory("cat-b", { order: 1 });
    const catC = makeCategory("cat-c", { order: 2 });
    s.getState().setInitialData([catA, catB, catC]);

    s.getState().reorderCategories(null, ["cat-c", "cat-a", "cat-b"]);

    const ids = s.getState().categories.map((c) => c.id);
    expect(ids).toEqual(["cat-c", "cat-a", "cat-b"]);
  });

  it("reorders children within a parent", async () => {
    const s = await getStore();
    const child1 = { ...makeCategory("child-1"), parentId: "parent", order: 0 };
    const child2 = { ...makeCategory("child-2"), parentId: "parent", order: 1 };
    const parent = makeCategory("parent", { children: [child1, child2] });
    s.getState().setInitialData([parent]);

    s.getState().reorderCategories("parent", ["child-2", "child-1"]);

    const children = s.getState().categories[0].children;
    expect(children[0].id).toBe("child-2");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// rebuildSearchIndex
// ─────────────────────────────────────────────────────────────────────────────

describe("rebuildSearchIndex", () => {
  it("rebuilds the search index from current categories", async () => {
    const s = await getStore();
    s.getState().setInitialData([makeCategory("cat-a", { questions: [makeQuestion("q1", "cat-a")] })]);
    s.setState({ searchIndex: null });

    s.getState().rebuildSearchIndex();

    expect(s.getState().searchIndex).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// setStatusFilter / setAllTags
// ─────────────────────────────────────────────────────────────────────────────

describe("setStatusFilter", () => {
  it("sets a non-null status filter", async () => {
    const s = await getStore();
    s.getState().setStatusFilter("SOLVED");
    expect(s.getState().filterStatus).toBe("SOLVED");
  });

  it("clears the status filter when null is passed", async () => {
    const s = await getStore();
    s.getState().setStatusFilter("SOLVED");
    s.getState().setStatusFilter(null);
    expect(s.getState().filterStatus).toBeNull();
  });
});

describe("setAllTags", () => {
  it("replaces the allTags list", async () => {
    const s = await getStore();
    const tags: Tag[] = [{ id: "t1", name: "arrays", color: "blue" }];
    s.getState().setAllTags(tags);
    expect(s.getState().allTags).toEqual(tags);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// createTag (async)
// ─────────────────────────────────────────────────────────────────────────────

describe("createTag", () => {
  it("adds the new tag to allTags and returns it", async () => {
    const s = await getStore();
    const tag = await s.getState().createTag("dp", "green");
    expect(tag).not.toBeNull();
    expect(tag?.id).toBe("real-tag-id");
    expect(s.getState().allTags.some((t) => t.id === "real-tag-id")).toBe(true);
  });

  it("returns null on server error", async () => {
    const s = await getStore();
    mockSync.createTag.mockResolvedValueOnce({ ok: false });
    const tag = await s.getState().createTag("dp", "green");
    expect(tag).toBeNull();
  });

  it("keeps allTags sorted alphabetically after creating", async () => {
    const s = await getStore();
    s.setState({ allTags: [{ id: "t-z", name: "zzz", color: "blue" }] });
    mockSync.createTag.mockResolvedValueOnce({ ok: true, id: "t-a" });
    await s.getState().createTag("aaa", "red");
    expect(s.getState().allTags[0].name).toBe("aaa");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// deleteTag
// ─────────────────────────────────────────────────────────────────────────────

describe("deleteTag", () => {
  it("removes tag from allTags and from all questions", async () => {
    const s = await getStore();
    const tag: Tag = { id: "t1", name: "dp", color: "blue" };
    const q = makeQuestion("q1", "cat-a", 0, { tags: [tag] });
    s.getState().setInitialData([makeCategory("cat-a", { questions: [q] })]);
    s.setState({ allTags: [tag] });

    s.getState().deleteTag("t1");

    expect(s.getState().allTags).toHaveLength(0);
    expect(s.getState().categories[0].questions[0].tags).toHaveLength(0);
  });

  it("removes the tag from filterTagIds", async () => {
    const s = await getStore();
    s.setState({ allTags: [{ id: "t1", name: "dp", color: "blue" }], filterTagIds: ["t1", "t2"] });
    s.getState().deleteTag("t1");
    expect(s.getState().filterTagIds).not.toContain("t1");
    expect(s.getState().filterTagIds).toContain("t2");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// addTagToQuestion / removeTagFromQuestion
// ─────────────────────────────────────────────────────────────────────────────

describe("addTagToQuestion", () => {
  it("attaches an existing tag to a question", async () => {
    const s = await getStore();
    const tag: Tag = { id: "t1", name: "dp", color: "blue" };
    s.getState().setInitialData([makeCategory("cat-a", { questions: [makeQuestion("q1", "cat-a")] })]);
    s.setState({ allTags: [tag] });

    s.getState().addTagToQuestion("q1", "t1");

    expect(s.getState().categories[0].questions[0].tags).toContainEqual(tag);
  });

  it("does not duplicate a tag that is already on the question", async () => {
    const s = await getStore();
    const tag: Tag = { id: "t1", name: "dp", color: "blue" };
    const q = makeQuestion("q1", "cat-a", 0, { tags: [tag] });
    s.getState().setInitialData([makeCategory("cat-a", { questions: [q] })]);
    s.setState({ allTags: [tag] });

    s.getState().addTagToQuestion("q1", "t1");

    expect(s.getState().categories[0].questions[0].tags).toHaveLength(1);
  });

  it("does nothing when the tag does not exist in allTags", async () => {
    const s = await getStore();
    s.getState().setInitialData([makeCategory("cat-a", { questions: [makeQuestion("q1", "cat-a")] })]);
    s.getState().addTagToQuestion("q1", "missing-tag");
    expect(s.getState().categories[0].questions[0].tags).toHaveLength(0);
  });
});

describe("removeTagFromQuestion", () => {
  it("detaches a tag from the question", async () => {
    const s = await getStore();
    const tag: Tag = { id: "t1", name: "dp", color: "blue" };
    const q = makeQuestion("q1", "cat-a", 0, { tags: [tag] });
    s.getState().setInitialData([makeCategory("cat-a", { questions: [q] })]);

    s.getState().removeTagFromQuestion("q1", "t1");

    expect(s.getState().categories[0].questions[0].tags).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// toggleTagFilter / clearTagFilter
// ─────────────────────────────────────────────────────────────────────────────

describe("toggleTagFilter", () => {
  it("adds a tag to filterTagIds when absent", async () => {
    const s = await getStore();
    s.getState().toggleTagFilter("t1");
    expect(s.getState().filterTagIds).toContain("t1");
  });

  it("removes a tag from filterTagIds when present", async () => {
    const s = await getStore();
    s.setState({ filterTagIds: ["t1", "t2"] });
    s.getState().toggleTagFilter("t1");
    expect(s.getState().filterTagIds).not.toContain("t1");
    expect(s.getState().filterTagIds).toContain("t2");
  });
});

describe("clearTagFilter", () => {
  it("empties filterTagIds", async () => {
    const s = await getStore();
    s.setState({ filterTagIds: ["t1", "t2"] });
    s.getState().clearTagFilter();
    expect(s.getState().filterTagIds).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// exported helpers
// ─────────────────────────────────────────────────────────────────────────────

describe("getAllQuestions", () => {
  it("flattens questions across nested categories", async () => {
    const { getAllQuestions } = await import("@/store/workspace-store");
    const child = { ...makeCategory("child"), parentId: "parent", questions: [makeQuestion("q2", "child")] };
    const parent = makeCategory("parent", { questions: [makeQuestion("q1", "parent")], children: [child] });
    const result = getAllQuestions([parent]);
    expect(result.map((q) => q.id)).toEqual(["q1", "q2"]);
  });

  it("returns empty array for no categories", async () => {
    const { getAllQuestions } = await import("@/store/workspace-store");
    expect(getAllQuestions([])).toHaveLength(0);
  });
});

describe("sortQuestionsForDisplay", () => {
  it("sorts pinned questions before unpinned", async () => {
    const { sortQuestionsForDisplay } = await import("@/store/workspace-store");
    const q1 = makeQuestion("q1", "cat", 0, { isPinned: false });
    const q2 = makeQuestion("q2", "cat", 1, { isPinned: true });
    const result = sortQuestionsForDisplay([q1, q2]);
    expect(result[0].id).toBe("q2");
  });
});

describe("getCategoryForQuestion", () => {
  it("returns the category that owns the question", async () => {
    const { getCategoryForQuestion } = await import("@/store/workspace-store");
    const catA = makeCategory("cat-a", { questions: [makeQuestion("q1", "cat-a")] });
    expect(getCategoryForQuestion([catA], "q1")?.id).toBe("cat-a");
  });

  it("returns null for a null questionId", async () => {
    const { getCategoryForQuestion } = await import("@/store/workspace-store");
    expect(getCategoryForQuestion([], null)).toBeNull();
  });
});

describe("getCategoryById", () => {
  it("returns the category with the given id", async () => {
    const { getCategoryById } = await import("@/store/workspace-store");
    const catB = makeCategory("cat-b");
    expect(getCategoryById([makeCategory("cat-a"), catB], "cat-b")?.id).toBe("cat-b");
  });

  it("returns null for a null categoryId", async () => {
    const { getCategoryById } = await import("@/store/workspace-store");
    expect(getCategoryById([], null)).toBeNull();
  });

  it("returns null when the category does not exist", async () => {
    const { getCategoryById } = await import("@/store/workspace-store");
    expect(getCategoryById([makeCategory("cat-a")], "missing")).toBeNull();
  });
});
