import type { Category } from "@/types/knowledge";
import type { Question } from "@/types/knowledge";

function filterTree(categories: Category[], questionPredicate: (q: Question) => boolean) {
  const walk = (nodes: Category[]): Category[] => {
    return nodes
      .map((cat) => {
        const questions = cat.questions.filter(questionPredicate);
        const children = walk(cat.children);
        if (questions.length === 0 && children.length === 0) return null;
        return { ...cat, questions, children };
      })
      .filter((x): x is Category => x !== null);
  };

  return walk(categories);
}

export function filterFavoriteCategories(categories: Category[]) {
  return filterTree(categories, (q) => q.isFavorite);
}

/**
 * Note: “most viewed” is currently tracked in the client (localStorage via Sidebar).
 * This server helper provides a best-effort initial state by returning all categories.
 * The client can further filter/render based on localStorage.
 */
export function filterMostViewedCategories(categories: Category[]) {
  // best-effort: return categories as-is.
  // If/when visitCounts becomes a persisted DB field, this can be replaced.
  return categories;
}

