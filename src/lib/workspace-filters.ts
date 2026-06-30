import type { Category, Question } from "@/types/knowledge";

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


