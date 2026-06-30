export type Difficulty = "EASY" | "MEDIUM" | "HARD";

export type SolutionLanguage = "none" | "java" | "cpp" | "javascript" | "typescript" | "python" | "sql";

import type { ReviewResult } from "@/lib/ai-answer";

export type Solution = {
  id: string;
  questionId: string;
  title: string;
  language: SolutionLanguage;
  content: string;
  notes: string;
  aiReview: ReviewResult | null;
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
