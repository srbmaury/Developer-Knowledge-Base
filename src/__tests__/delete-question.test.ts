/**
 * Tests for the deleteQuestion selection logic.
 * The pure helpers (removeQuestion, findCategory) are private, so we test
 * the observable behaviour through the public Zustand store API.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── mock external side effects ────────────────────────────────────────────────

vi.mock("@/lib/workspace-sync", () => ({
  workspaceSync: {
    deleteQuestion: vi.fn().mockResolvedValue({ ok: true }),
    createQuestion: vi.fn(),
    createSolution: vi.fn(),
    updateSolution: vi.fn(),
    updateQuestion: vi.fn(),
    updateCategory: vi.fn(),
    updateCategoryVisibility: vi.fn(),
    createCategory: vi.fn(),
    deleteCategory: vi.fn(),
    deleteSolution: vi.fn(),
    reorderCategories: vi.fn(),
    reorderQuestions: vi.fn()
  }
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Minimal localStorage stub
const lsStore: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (k: string) => lsStore[k] ?? null,
  setItem: (k: string, v: string) => { lsStore[k] = v; },
  removeItem: (k: string) => { delete lsStore[k]; }
});

// ── helpers ───────────────────────────────────────────────────────────────────

import type { Category } from "@/types/knowledge";

const NOW = new Date().toISOString();

function makeQuestion(id: string, categoryId: string, order = 0) {
  return {
    id,
    categoryId,
    title: `Question ${id}`,
    description: "",
    difficulty: "MEDIUM" as const,
    isFavorite: false,
    isPinned: false,
    order,
    createdAt: NOW,
    updatedAt: NOW,
    solutions: [{ id: `sol-${id}`, questionId: id, title: "Approach", language: "typescript" as const, content: "", notes: "", order: 0, createdAt: NOW, updatedAt: NOW }]
  };
}

function makeCategory(id: string, questions: ReturnType<typeof makeQuestion>[]): Category {
  return {
    id,
    userId: "user-1",
    name: `Category ${id}`,
    isPublic: false,
    canEdit: true,
    parentId: null,
    order: 0,
    createdAt: NOW,
    children: [],
    questions
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("deleteQuestion – category retention", () => {
  beforeEach(async () => {
    // Reset store to a fresh state before each test.
    const { useWorkspaceStore } = await import("@/store/workspace-store");
    useWorkspaceStore.setState({
      categories: [],
      selectedCategoryId: null,
      selectedQuestionId: null,
      selectedSolutionId: null,
      questionIdToCategoryId: new Map(),
      solutionIdToLocation: new Map()
    });
  });

  it("keeps the same category when deleting the selected question and another exists in the category", async () => {
    const { useWorkspaceStore } = await import("@/store/workspace-store");
    const q1 = makeQuestion("q1", "cat-a", 0);
    const q2 = makeQuestion("q2", "cat-a", 1);
    const catA = makeCategory("cat-a", [q1, q2]);
    const catB = makeCategory("cat-b", [makeQuestion("q3", "cat-b", 0)]);

    useWorkspaceStore.getState().setInitialData([catA, catB]);
    useWorkspaceStore.setState({ selectedCategoryId: "cat-a", selectedQuestionId: "q1" });

    useWorkspaceStore.getState().deleteQuestion("q1");

    const state = useWorkspaceStore.getState();
    expect(state.selectedCategoryId).toBe("cat-a");
    expect(state.selectedQuestionId).toBe("q2");
  });

  it("keeps the same category when deleting the last question in it", async () => {
    const { useWorkspaceStore } = await import("@/store/workspace-store");
    const q1 = makeQuestion("q1", "cat-a");
    const catA = makeCategory("cat-a", [q1]);
    const catB = makeCategory("cat-b", [makeQuestion("q2", "cat-b")]);

    useWorkspaceStore.getState().setInitialData([catA, catB]);
    useWorkspaceStore.setState({ selectedCategoryId: "cat-a", selectedQuestionId: "q1" });

    useWorkspaceStore.getState().deleteQuestion("q1");

    const state = useWorkspaceStore.getState();
    // Category must NOT jump to cat-b even though q2 exists there.
    expect(state.selectedCategoryId).toBe("cat-a");
    expect(state.selectedQuestionId).toBeNull();
  });

  it("does not change selection when a non-selected question is deleted", async () => {
    const { useWorkspaceStore } = await import("@/store/workspace-store");
    const q1 = makeQuestion("q1", "cat-a", 0);
    const q2 = makeQuestion("q2", "cat-a", 1);
    const catA = makeCategory("cat-a", [q1, q2]);

    useWorkspaceStore.getState().setInitialData([catA]);
    useWorkspaceStore.setState({ selectedCategoryId: "cat-a", selectedQuestionId: "q1" });

    useWorkspaceStore.getState().deleteQuestion("q2");

    const state = useWorkspaceStore.getState();
    expect(state.selectedCategoryId).toBe("cat-a");
    expect(state.selectedQuestionId).toBe("q1");
  });

  it("selects the solution of the next question after deletion", async () => {
    const { useWorkspaceStore } = await import("@/store/workspace-store");
    const q1 = makeQuestion("q1", "cat-a", 0);
    const q2 = makeQuestion("q2", "cat-a", 1);
    const catA = makeCategory("cat-a", [q1, q2]);

    useWorkspaceStore.getState().setInitialData([catA]);
    useWorkspaceStore.setState({ selectedCategoryId: "cat-a", selectedQuestionId: "q1", selectedSolutionId: "sol-q1" });

    useWorkspaceStore.getState().deleteQuestion("q1");

    expect(useWorkspaceStore.getState().selectedSolutionId).toBe("sol-q2");
  });
});
