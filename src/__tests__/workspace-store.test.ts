/**
 * Comprehensive tests for the observable behaviour of useWorkspaceStore.
 * We test through the public API rather than internal helpers.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── mock external side effects ────────────────────────────────────────────────

vi.mock("@/lib/workspace-sync", () => ({
  workspaceSync: {
    deleteQuestion: vi.fn().mockResolvedValue({ ok: true }),
    createQuestion: vi.fn(),
    createSolution: vi.fn(),
    updateSolution: vi.fn().mockResolvedValue({ ok: true }),
    updateQuestion: vi.fn().mockResolvedValue({ ok: true }),
    updateCategory: vi.fn(),
    updateCategoryVisibility: vi.fn(),
    createCategory: vi.fn(),
    deleteCategory: vi.fn(),
    deleteSolution: vi.fn().mockResolvedValue({ ok: true }),
    reorderCategories: vi.fn(),
    reorderQuestions: vi.fn(),
    createTag: vi.fn(),
    deleteTag: vi.fn(),
    addTagToQuestion: vi.fn(),
    removeTagFromQuestion: vi.fn()
  }
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Minimal localStorage stub — shared across tests
const lsStore: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (k: string) => lsStore[k] ?? null,
  setItem: (k: string, v: string) => { lsStore[k] = v; },
  removeItem: (k: string) => { delete lsStore[k]; }
});

// ── shared helpers ────────────────────────────────────────────────────────────

import type { Category, SolutionLanguage } from "@/types/knowledge";

const NOW = new Date().toISOString();

function makeSolution(id: string, questionId: string, opts?: { language?: SolutionLanguage }) {
  return {
    id,
    questionId,
    title: "Best Approach",
    language: (opts?.language ?? "typescript") as SolutionLanguage,
    content: "",
    notes: "",
    aiReview: null,
    order: 0,
    createdAt: NOW,
    updatedAt: NOW
  };
}

function makeQuestion(id: string, categoryId: string, order = 0, opts?: { isPinned?: boolean; isFavorite?: boolean }) {
  return {
    id,
    categoryId,
    title: `Question ${id}`,
    description: "",
    difficulty: "MEDIUM" as const,
    isFavorite: opts?.isFavorite ?? false,
    isPinned: opts?.isPinned ?? false,
    order,
    createdAt: NOW,
    updatedAt: NOW,
    solutions: [makeSolution(`sol-${id}`, id)],
    tags: [],
    status: "NOT_STARTED" as const,
    srDue: null,
    srInterval: 1,
    srEase: 2.5,
    srReviews: 0
  };
}

function makeCategory(id: string, opts?: {
  questions?: ReturnType<typeof makeQuestion>[];
  children?: Category[];
  canEdit?: boolean;
  order?: number;
}): Category {
  return {
    id,
    userId: "user-1",
    name: `Category ${id}`,
    isPublic: false,
    canEdit: opts?.canEdit ?? true,
    parentId: null,
    order: opts?.order ?? 0,
    createdAt: NOW,
    children: opts?.children ?? [],
    questions: opts?.questions ?? []
  };
}

async function getStore() {
  const { useWorkspaceStore } = await import("@/store/workspace-store");
  return useWorkspaceStore;
}

// ── reset before each test ────────────────────────────────────────────────────

beforeEach(async () => {
  // Clear the localStorage stub
  for (const key of Object.keys(lsStore)) delete lsStore[key];

  const { useWorkspaceStore } = await import("@/store/workspace-store");
  const { resetSaveScheduler } = await import("@/store/workspace-save-scheduler");
  resetSaveScheduler();

  useWorkspaceStore.setState({
    categories: [],
    selectedCategoryId: null,
    selectedQuestionId: null,
    selectedSolutionId: null,
    expandedCategoryIds: [],
    questionById: new Map(),
    questionIdToCategoryId: new Map(),
    solutionIdToLocation: new Map(),
    searchIndex: null,
    defaultLanguage: "typescript",
    creatingCategoryKeys: [],
    creatingQuestionCategoryIds: [],
    creatingSolutionQuestionIds: [],
    failedSolutionContentIds: [],
    filterStatus: null,
    allTags: [],
    filterTagIds: []
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// setInitialData
// ─────────────────────────────────────────────────────────────────────────────

describe("setInitialData", () => {
  it("selects the first category and question when no prior state exists", async () => {
    const store = await getStore();
    const q1 = makeQuestion("q1", "cat-a");
    const catA = makeCategory("cat-a", { questions: [q1] });
    const catB = makeCategory("cat-b", { questions: [makeQuestion("q2", "cat-b")] });

    store.getState().setInitialData([catA, catB]);

    const state = store.getState();
    expect(state.selectedCategoryId).toBe("cat-a");
    expect(state.selectedQuestionId).toBe("q1");
    expect(state.selectedSolutionId).toBe("sol-q1");
  });

  it("preserves a previously selected category that still exists", async () => {
    const store = await getStore();
    store.setState({ selectedCategoryId: "cat-b", selectedQuestionId: "q2", selectedSolutionId: "sol-q2" });

    const catA = makeCategory("cat-a", { questions: [makeQuestion("q1", "cat-a")] });
    const catB = makeCategory("cat-b", { questions: [makeQuestion("q2", "cat-b")] });

    store.getState().setInitialData([catA, catB]);

    const state = store.getState();
    expect(state.selectedCategoryId).toBe("cat-b");
    expect(state.selectedQuestionId).toBe("q2");
  });

  it("resets to the first question when the previously selected question no longer exists", async () => {
    const store = await getStore();
    // old selection points to a question that is gone
    store.setState({ selectedCategoryId: "cat-a", selectedQuestionId: "gone", selectedSolutionId: "sol-gone" });

    const catA = makeCategory("cat-a", { questions: [makeQuestion("q1", "cat-a")] });
    store.getState().setInitialData([catA]);

    const state = store.getState();
    expect(state.selectedQuestionId).toBe("q1");
    expect(state.selectedSolutionId).toBe("sol-q1");
  });

  it("uses expandedCategoryIds from localStorage when present", async () => {
    const store = await getStore();
    lsStore["developer-knowledge-base-workspace"] = JSON.stringify({
      state: { expandedCategoryIds: ["cat-b"] }
    });

    const catA = makeCategory("cat-a", { questions: [makeQuestion("q1", "cat-a")] });
    const catB = makeCategory("cat-b", { questions: [makeQuestion("q2", "cat-b")] });
    store.getState().setInitialData([catA, catB]);

    // Only cat-b should be expanded (from localStorage), not the default first-category
    expect(store.getState().expandedCategoryIds).toEqual(["cat-b"]);
  });

  it("uses an empty expandedCategoryIds array from localStorage when explicitly stored", async () => {
    const store = await getStore();
    lsStore["developer-knowledge-base-workspace"] = JSON.stringify({
      state: { expandedCategoryIds: [] }
    });

    const catA = makeCategory("cat-a", { questions: [makeQuestion("q1", "cat-a")] });
    store.getState().setInitialData([catA]);

    expect(store.getState().expandedCategoryIds).toEqual([]);
  });

  it("builds the questionIdToCategoryId index", async () => {
    const store = await getStore();
    const q1 = makeQuestion("q1", "cat-a");
    const q2 = makeQuestion("q2", "cat-b");
    const catA = makeCategory("cat-a", { questions: [q1] });
    const catB = makeCategory("cat-b", { questions: [q2] });

    store.getState().setInitialData([catA, catB]);

    expect(store.getState().questionIdToCategoryId.get("q1")).toBe("cat-a");
    expect(store.getState().questionIdToCategoryId.get("q2")).toBe("cat-b");
  });

  it("keeps local edits when a save is pending and setInitialData arrives", async () => {
    const store = await getStore();
    const q1 = makeQuestion("q1", "cat-a");
    const catA = makeCategory("cat-a", { questions: [q1] });
    store.getState().setInitialData([catA]);

    store.getState().updateQuestionTitle("q1", "Local edit");

    const remoteQuestion = { ...q1, title: "Remote title", updatedAt: new Date(Date.now() - 5000).toISOString() };
    const remoteCategory = makeCategory("cat-a", { questions: [remoteQuestion] });
    store.getState().setInitialData([remoteCategory]);

    expect(store.getState().questionById.get("q1")?.title).toBe("Local edit");
  });

  it("keeps local solution content/notes when stale remote data arrives after a save", async () => {
    const store = await getStore();
    const q1 = makeQuestion("q1", "cat-a");
    const catA = makeCategory("cat-a", { questions: [q1] });
    store.getState().setInitialData([catA]);

    store.getState().updateSolutionContent("sol-q1", "const x = 1;");
    store.getState().updateSolutionNotes("sol-q1", "Remember edge cases.");

    const remoteSolution = {
      ...q1.solutions[0],
      content: "",
      notes: "",
      aiReview: null,
      contentLoaded: false,
      updatedAt: new Date(Date.now() - 5000).toISOString()
    };
    const remoteQuestion = { ...q1, solutions: [remoteSolution], updatedAt: new Date(Date.now() - 5000).toISOString() };
    const remoteCategory = makeCategory("cat-a", { questions: [remoteQuestion] });

    store.getState().setInitialData([remoteCategory]);

    const q = store.getState().categories[0].questions[0];
    expect(q.solutions[0].content).toBe("const x = 1;");
    expect(q.solutions[0].notes).toBe("Remember edge cases.");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// selectCategory
// ─────────────────────────────────────────────────────────────────────────────

describe("selectCategory", () => {
  it("updates selectedCategoryId", async () => {
    const store = await getStore();
    store.getState().selectCategory("cat-x");
    expect(store.getState().selectedCategoryId).toBe("cat-x");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// selectQuestion
// ─────────────────────────────────────────────────────────────────────────────

describe("selectQuestion", () => {
  it("sets selectedQuestionId, selectedCategoryId, and first solution", async () => {
    const store = await getStore();
    const q1 = makeQuestion("q1", "cat-a");
    const catA = makeCategory("cat-a", { questions: [q1] });
    store.getState().setInitialData([catA]);

    store.getState().selectQuestion("q1");

    const state = store.getState();
    expect(state.selectedQuestionId).toBe("q1");
    expect(state.selectedCategoryId).toBe("cat-a");
    expect(state.selectedSolutionId).toBe("sol-q1");
  });

  it("uses the questionIdToCategoryId index for category resolution", async () => {
    const store = await getStore();
    const q1 = makeQuestion("q1", "cat-b");
    const catA = makeCategory("cat-a", { questions: [] });
    const catB = makeCategory("cat-b", { questions: [q1] });
    store.getState().setInitialData([catA, catB]);
    store.setState({ selectedCategoryId: "cat-a" });

    store.getState().selectQuestion("q1");

    expect(store.getState().selectedCategoryId).toBe("cat-b");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// toggleCategory
// ─────────────────────────────────────────────────────────────────────────────

describe("toggleCategory", () => {
  it("adds a category to expandedCategoryIds when it is not present", async () => {
    const store = await getStore();
    store.setState({ expandedCategoryIds: [] });

    store.getState().toggleCategory("cat-a");

    expect(store.getState().expandedCategoryIds).toContain("cat-a");
  });

  it("removes a category from expandedCategoryIds when it is already present", async () => {
    const store = await getStore();
    store.setState({ expandedCategoryIds: ["cat-a", "cat-b"] });

    store.getState().toggleCategory("cat-a");

    expect(store.getState().expandedCategoryIds).not.toContain("cat-a");
    expect(store.getState().expandedCategoryIds).toContain("cat-b");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateQuestionTitle / Description / Difficulty
// ─────────────────────────────────────────────────────────────────────────────

describe("updateQuestionTitle", () => {
  it("updates the title in the tree", async () => {
    const store = await getStore();
    const catA = makeCategory("cat-a", { questions: [makeQuestion("q1", "cat-a")] });
    store.getState().setInitialData([catA]);

    store.getState().updateQuestionTitle("q1", "New Title");

    const cat = store.getState().categories.find((c) => c.id === "cat-a")!;
    expect(cat.questions[0].title).toBe("New Title");
  });

  it("does nothing when the category is not editable", async () => {
    const store = await getStore();
    const catA = makeCategory("cat-a", { questions: [makeQuestion("q1", "cat-a")], canEdit: false });
    store.getState().setInitialData([catA]);

    console.log('DEBUG canEdit', store.getState().categories[0].canEdit);
    console.log('DEBUG categories', JSON.stringify(store.getState().categories, null, 2));

    store.getState().updateQuestionTitle("q1", "Ignored");

    const cat = store.getState().categories.find((c) => c.id === "cat-a")!;
    expect(cat.questions[0].title).toBe("Question q1");
  });
});

describe("updateQuestionDescription", () => {
  it("updates the description in the tree", async () => {
    const store = await getStore();
    const catA = makeCategory("cat-a", { questions: [makeQuestion("q1", "cat-a")] });
    store.getState().setInitialData([catA]);

    store.getState().updateQuestionDescription("q1", "Some description");

    const cat = store.getState().categories.find((c) => c.id === "cat-a")!;
    expect(cat.questions[0].description).toBe("Some description");
  });
});

describe("updateQuestionDifficulty", () => {
  it("updates the difficulty in the tree", async () => {
    const store = await getStore();
    const catA = makeCategory("cat-a", { questions: [makeQuestion("q1", "cat-a")] });
    store.getState().setInitialData([catA]);

    store.getState().updateQuestionDifficulty("q1", "HARD");

    const cat = store.getState().categories.find((c) => c.id === "cat-a")!;
    expect(cat.questions[0].difficulty).toBe("HARD");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateSolutionTitle / Content / Notes / Language
// ─────────────────────────────────────────────────────────────────────────────

describe("updateSolutionTitle", () => {
  it("updates the solution title in the tree", async () => {
    const store = await getStore();
    const catA = makeCategory("cat-a", { questions: [makeQuestion("q1", "cat-a")] });
    store.getState().setInitialData([catA]);

    store.getState().updateSolutionTitle("sol-q1", "Optimised Approach");

    const q = store.getState().categories[0].questions[0];
    expect(q.solutions[0].title).toBe("Optimised Approach");
  });

  it("does nothing when solution is not editable", async () => {
    const store = await getStore();
    const catA = makeCategory("cat-a", { questions: [makeQuestion("q1", "cat-a")], canEdit: false });
    store.getState().setInitialData([catA]);

    store.getState().updateSolutionTitle("sol-q1", "Ignored");

    const q = store.getState().categories[0].questions[0];
    expect(q.solutions[0].title).toBe("Best Approach");
  });
});

describe("updateSolutionContent", () => {
  it("updates solution content", async () => {
    const store = await getStore();
    const catA = makeCategory("cat-a", { questions: [makeQuestion("q1", "cat-a")] });
    store.getState().setInitialData([catA]);

    store.getState().updateSolutionContent("sol-q1", "const x = 1;");

    const q = store.getState().categories[0].questions[0];
    expect(q.solutions[0].content).toBe("const x = 1;");
  });
});

describe("updateSolutionNotes", () => {
  it("updates solution notes", async () => {
    const store = await getStore();
    const catA = makeCategory("cat-a", { questions: [makeQuestion("q1", "cat-a")] });
    store.getState().setInitialData([catA]);

    store.getState().updateSolutionNotes("sol-q1", "Remember to handle edge cases.");

    const q = store.getState().categories[0].questions[0];
    expect(q.solutions[0].notes).toBe("Remember to handle edge cases.");
  });
});

describe("updateSolutionLanguage", () => {
  it("updates the solution language in the tree", async () => {
    const store = await getStore();
    const catA = makeCategory("cat-a", { questions: [makeQuestion("q1", "cat-a")] });
    store.getState().setInitialData([catA]);

    store.getState().updateSolutionLanguage("sol-q1", "python");

    const q = store.getState().categories[0].questions[0];
    expect(q.solutions[0].language).toBe("python");
  });

  it("updates defaultLanguage when the new language is not 'none'", async () => {
    const store = await getStore();
    const catA = makeCategory("cat-a", { questions: [makeQuestion("q1", "cat-a")] });
    store.getState().setInitialData([catA]);

    store.getState().updateSolutionLanguage("sol-q1", "python");

    expect(store.getState().defaultLanguage).toBe("python");
  });

  it("does NOT update defaultLanguage when the new language is 'none'", async () => {
    const store = await getStore();
    const catA = makeCategory("cat-a", { questions: [makeQuestion("q1", "cat-a")] });
    store.getState().setInitialData([catA]);
    store.setState({ defaultLanguage: "typescript" });

    store.getState().updateSolutionLanguage("sol-q1", "none");

    expect(store.getState().defaultLanguage).toBe("typescript");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// toggleFavorite
// ─────────────────────────────────────────────────────────────────────────────

describe("toggleFavorite", () => {
  it("flips isFavorite from false to true", async () => {
    const store = await getStore();
    const q = makeQuestion("q1", "cat-a", 0, { isFavorite: false });
    const catA = makeCategory("cat-a", { questions: [q] });
    store.getState().setInitialData([catA]);

    store.getState().toggleFavorite("q1");

    expect(store.getState().categories[0].questions[0].isFavorite).toBe(true);
  });

  it("flips isFavorite from true to false", async () => {
    const store = await getStore();
    const q = makeQuestion("q1", "cat-a", 0, { isFavorite: true });
    const catA = makeCategory("cat-a", { questions: [q] });
    store.getState().setInitialData([catA]);

    store.getState().toggleFavorite("q1");

    expect(store.getState().categories[0].questions[0].isFavorite).toBe(false);
  });

  it("does nothing when the category is not editable", async () => {
    const store = await getStore();
    const q = makeQuestion("q1", "cat-a", 0, { isFavorite: false });
    const catA = makeCategory("cat-a", { questions: [q], canEdit: false });
    store.getState().setInitialData([catA]);

    store.getState().toggleFavorite("q1");

    expect(store.getState().categories[0].questions[0].isFavorite).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// toggleImportant (isPinned)
// ─────────────────────────────────────────────────────────────────────────────

describe("toggleImportant", () => {
  it("flips isPinned from false to true and moves question to front", async () => {
    const store = await getStore();
    const q1 = makeQuestion("q1", "cat-a", 0);
    const q2 = makeQuestion("q2", "cat-a", 1, { isPinned: false });
    const catA = makeCategory("cat-a", { questions: [q1, q2] });
    store.getState().setInitialData([catA]);

    store.getState().toggleImportant("q2");

    const questions = store.getState().categories[0].questions;
    // q2 is now pinned and should appear before q1 (which is not pinned)
    expect(questions[0].id).toBe("q2");
    expect(questions[0].isPinned).toBe(true);
  });

  it("flips isPinned from true to false", async () => {
    const store = await getStore();
    const q1 = makeQuestion("q1", "cat-a", 0, { isPinned: true });
    const catA = makeCategory("cat-a", { questions: [q1] });
    store.getState().setInitialData([catA]);

    store.getState().toggleImportant("q1");

    expect(store.getState().categories[0].questions[0].isPinned).toBe(false);
  });

  it("does nothing when the category is not editable", async () => {
    const store = await getStore();
    const q1 = makeQuestion("q1", "cat-a", 0, { isPinned: false });
    const catA = makeCategory("cat-a", { questions: [q1], canEdit: false });
    store.getState().setInitialData([catA]);

    store.getState().toggleImportant("q1");

    expect(store.getState().categories[0].questions[0].isPinned).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// reorderQuestions
// ─────────────────────────────────────────────────────────────────────────────

describe("reorderQuestions", () => {
  it("reorders questions within a category", async () => {
    const store = await getStore();
    const q1 = makeQuestion("q1", "cat-a", 0);
    const q2 = makeQuestion("q2", "cat-a", 1);
    const q3 = makeQuestion("q3", "cat-a", 2);
    const catA = makeCategory("cat-a", { questions: [q1, q2, q3] });
    store.getState().setInitialData([catA]);

    store.getState().reorderQuestions("cat-a", ["q3", "q1", "q2"]);

    const questions = store.getState().categories[0].questions;
    expect(questions.map((q) => q.id)).toEqual(["q3", "q1", "q2"]);
  });

  it("assigns ascending order values after reorder", async () => {
    const store = await getStore();
    const q1 = makeQuestion("q1", "cat-a", 0);
    const q2 = makeQuestion("q2", "cat-a", 1);
    const catA = makeCategory("cat-a", { questions: [q1, q2] });
    store.getState().setInitialData([catA]);

    store.getState().reorderQuestions("cat-a", ["q2", "q1"]);

    const questions = store.getState().categories[0].questions;
    expect(questions[0].order).toBe(0);
    expect(questions[1].order).toBe(1);
  });

  it("does nothing when the category is not editable", async () => {
    const store = await getStore();
    const q1 = makeQuestion("q1", "cat-a", 0);
    const q2 = makeQuestion("q2", "cat-a", 1);
    const catA = makeCategory("cat-a", { questions: [q1, q2], canEdit: false });
    store.getState().setInitialData([catA]);

    store.getState().reorderQuestions("cat-a", ["q2", "q1"]);

    // Order unchanged
    const questions = store.getState().categories[0].questions;
    expect(questions[0].id).toBe("q1");
  });

  it("keeps pinned questions sorted before unpinned questions", async () => {
    const store = await getStore();
    const q1 = makeQuestion("q1", "cat-a", 0, { isPinned: true });
    const q2 = makeQuestion("q2", "cat-a", 1, { isPinned: false });
    const q3 = makeQuestion("q3", "cat-a", 2, { isPinned: false });
    const catA = makeCategory("cat-a", { questions: [q1, q2, q3] });
    store.getState().setInitialData([catA]);

    // Attempt to re-order with pinned first, then unpinned
    store.getState().reorderQuestions("cat-a", ["q1", "q3", "q2"]);

    const questions = store.getState().categories[0].questions;
    // Pinned q1 must still appear first
    expect(questions[0].isPinned).toBe(true);
    expect(questions[0].id).toBe("q1");
  });
});
