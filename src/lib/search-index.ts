import MiniSearch from "minisearch";
import type { Category, Question } from "@/types/knowledge";

type SearchDoc = {
  id: string;
  title: string;
  description: string;
  content: string;
  notes: string;
  tags: string;
};

export type SearchResult = {
  id: string;
  score: number;
  match: Record<string, string[]>;
};

export function buildSearchIndex(categories: Category[]): MiniSearch<SearchDoc> {
  const index = new MiniSearch<SearchDoc>({
    fields: ["title", "description", "content", "notes", "tags"],
    storeFields: ["title"],
    searchOptions: {
      boost: { title: 4, tags: 2.5, description: 1.5, content: 1, notes: 0.8 },
      fuzzy: 0.15,
      prefix: true,
      combineWith: "AND"
    }
  });

  const docs: SearchDoc[] = [];

  const visit = (cats: Category[]) => {
    for (const cat of cats) {
      for (const q of cat.questions) {
        docs.push(questionToDoc(q));
      }
      visit(cat.children);
    }
  };

  visit(categories);
  index.addAll(docs);
  return index;
}

export function questionToDoc(q: Question): SearchDoc {
  return {
    id: q.id,
    title: q.title,
    description: q.description,
    content: q.solutions.map((s) => s.content).join(" "),
    notes: q.solutions.map((s) => s.notes).join(" "),
    tags: q.tags.map((t) => t.name).join(" ")
  };
}
