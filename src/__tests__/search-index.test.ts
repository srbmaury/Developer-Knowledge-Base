import { describe, expect, it } from "vitest";
import { questionToDoc } from "@/lib/search-index";
import type { Question } from "@/types/knowledge";

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: "q-1",
    categoryId: "cat-1",
    title: "Binary Search",
    description: "Find target in sorted array",
    difficulty: "MEDIUM",
    isFavorite: false,
    isPinned: false,
    order: 0,
    status: "NOT_STARTED",
    srDue: null,
    srInterval: 1,
    srEase: 2.5,
    srReviews: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    solutions: [],
    tags: [],
    ...overrides,
  };
}

describe("questionToDoc", () => {
  it("maps id, title, description directly", () => {
    const doc = questionToDoc(makeQuestion({ id: "abc", title: "Two Sum", description: "Add two numbers" }));
    expect(doc.id).toBe("abc");
    expect(doc.title).toBe("Two Sum");
    expect(doc.description).toBe("Add two numbers");
  });

  it("joins tag names with a space", () => {
    const q = makeQuestion({
      tags: [
        { id: "t1", name: "arrays", color: "blue" },
        { id: "t2", name: "hash-map", color: "green" },
      ],
    });
    expect(questionToDoc(q).tags).toBe("arrays hash-map");
  });

  it("returns empty string for tags when there are none", () => {
    expect(questionToDoc(makeQuestion({ tags: [] })).tags).toBe("");
  });

  it("joins solution content with a space", () => {
    const q = makeQuestion({
      solutions: [
        { id: "s1", questionId: "q-1", title: "", language: "typescript", content: "function foo() {}", notes: "", aiReview: null, contentLoaded: true, order: 0, createdAt: "", updatedAt: "" },
        { id: "s2", questionId: "q-1", title: "", language: "typescript", content: "function bar() {}", notes: "", aiReview: null, contentLoaded: true, order: 1, createdAt: "", updatedAt: "" },
      ],
    });
    expect(questionToDoc(q).content).toBe("function foo() {} function bar() {}");
  });

  it("joins solution notes with a space", () => {
    const q = makeQuestion({
      solutions: [
        { id: "s1", questionId: "q-1", title: "", language: "typescript", content: "", notes: "note one", aiReview: null, contentLoaded: true, order: 0, createdAt: "", updatedAt: "" },
        { id: "s2", questionId: "q-1", title: "", language: "typescript", content: "", notes: "note two", aiReview: null, contentLoaded: true, order: 1, createdAt: "", updatedAt: "" },
      ],
    });
    expect(questionToDoc(q).notes).toBe("note one note two");
  });

  it("returns empty strings for content and notes when there are no solutions", () => {
    const doc = questionToDoc(makeQuestion({ solutions: [] }));
    expect(doc.content).toBe("");
    expect(doc.notes).toBe("");
  });
});
