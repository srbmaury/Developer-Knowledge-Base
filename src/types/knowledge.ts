export type Difficulty = "EASY" | "MEDIUM" | "HARD";

export type SolutionLanguage = "none" | "java" | "cpp" | "javascript" | "typescript" | "python" | "sql";

export type TagColor = "gray" | "red" | "orange" | "yellow" | "green" | "blue" | "purple" | "pink";

export type Tag = {
  id: string;
  name: string;
  color: TagColor;
};

import type { ReviewResult } from "@/lib/ai-answer";

export type Solution = {
  id: string;
  questionId: string;
  title: string;
  language: SolutionLanguage;
  content: string;
  notes: string;
  aiReview: ReviewResult | null;
  /** False when only metadata was loaded; content/notes/aiReview pending a fetch */
  contentLoaded?: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type QuestionStatus = "NOT_STARTED" | "IN_PROGRESS" | "SOLVED";

export type Question = {
  id: string;
  categoryId: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  isFavorite: boolean;
  isPinned: boolean;
  order: number;
  status: QuestionStatus;
  srDue: string | null;
  srInterval: number;
  srEase: number;
  srReviews: number;
  createdAt: string;
  updatedAt: string;
  solutions: Solution[];
  tags: Tag[];
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
