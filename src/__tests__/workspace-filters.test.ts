import { describe, expect, it } from "vitest";
import { filterFavoriteCategories } from "@/lib/workspace-filters";
import type { Category, Question } from "@/types/knowledge";

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: "q-1",
    categoryId: "cat-1",
    title: "Test question",
    description: "",
    difficulty: "MEDIUM",
    isFavorite: false,
    isPinned: false,
    order: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    solutions: [],
    ...overrides
  };
}

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: "cat-1",
    userId: "user-1",
    name: "Test",
    isPublic: false,
    canEdit: true,
    parentId: null,
    order: 0,
    createdAt: new Date().toISOString(),
    children: [],
    questions: [],
    ...overrides
  };
}

describe("filterFavoriteCategories", () => {
  it("returns empty array for empty input", () => {
    expect(filterFavoriteCategories([])).toEqual([]);
  });

  it("drops categories that have no favorite questions and no children", () => {
    const cats = [
      makeCategory({ questions: [makeQuestion({ isFavorite: false })] })
    ];
    expect(filterFavoriteCategories(cats)).toEqual([]);
  });

  it("retains categories that have at least one favorite question", () => {
    const fav = makeQuestion({ id: "q-1", isFavorite: true });
    const notFav = makeQuestion({ id: "q-2", isFavorite: false });
    const cat = makeCategory({ questions: [fav, notFav] });

    const result = filterFavoriteCategories([cat]);
    expect(result).toHaveLength(1);
    // Only the favorite question is kept
    expect(result[0].questions).toHaveLength(1);
    expect(result[0].questions[0].id).toBe("q-1");
  });

  it("retains a parent category that has no favorites itself but whose child does", () => {
    const child = makeCategory({
      id: "child",
      parentId: "parent",
      questions: [makeQuestion({ id: "q-fav", isFavorite: true })]
    });
    const parent = makeCategory({
      id: "parent",
      questions: [],
      children: [child]
    });

    const result = filterFavoriteCategories([parent]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("parent");
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children[0].id).toBe("child");
  });

  it("drops a parent whose questions are all non-favorite and whose children have none either", () => {
    const child = makeCategory({
      id: "child",
      questions: [makeQuestion({ isFavorite: false })]
    });
    const parent = makeCategory({
      id: "parent",
      questions: [],
      children: [child]
    });

    expect(filterFavoriteCategories([parent])).toEqual([]);
  });

  it("handles deeply nested favorites correctly", () => {
    const grandchild = makeCategory({
      id: "gc",
      questions: [makeQuestion({ isFavorite: true })]
    });
    const child = makeCategory({ id: "child", questions: [], children: [grandchild] });
    const parent = makeCategory({ id: "parent", questions: [], children: [child] });

    const result = filterFavoriteCategories([parent]);
    expect(result[0].id).toBe("parent");
    expect(result[0].children[0].id).toBe("child");
    expect(result[0].children[0].children[0].id).toBe("gc");
  });

  it("filters multiple root categories independently", () => {
    const catWithFav = makeCategory({
      id: "a",
      questions: [makeQuestion({ isFavorite: true })]
    });
    const catWithout = makeCategory({
      id: "b",
      questions: [makeQuestion({ isFavorite: false })]
    });

    const result = filterFavoriteCategories([catWithFav, catWithout]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a");
  });
});
