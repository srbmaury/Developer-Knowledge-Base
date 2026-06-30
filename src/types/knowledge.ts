export type Difficulty = "EASY" | "MEDIUM" | "HARD";

export type SolutionLanguage = "none" | "java" | "cpp" | "javascript" | "typescript" | "python" | "sql";

export type Solution = {
  id: string;
  questionId: string;
  title: string;
  language: SolutionLanguage;
  content: string;
  notes: string;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type Question = {
  id: string;
  categoryId: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  isFavorite: boolean;
  isPinned: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
  solutions: Solution[];
};

export type Category = {
  id: string;
  userId: string;
  name: string;
  isPublic: boolean;
  canEdit: boolean;
  parentId: string | null;
  order: number;
  createdAt: string;
  children: Category[];
  questions: Question[];
};
