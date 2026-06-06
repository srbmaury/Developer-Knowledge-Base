export const SAVE_DEBOUNCE_MS = Number(process.env.NEXT_PUBLIC_SAVE_DEBOUNCE_MS ?? 1000);

import type { SolutionLanguage } from "@/types/knowledge";

export const LANGUAGES: Array<{ value: SolutionLanguage; label: string }> = [
  { value: "none", label: "None" },
  { value: "java", label: "Java" },
  { value: "cpp", label: "C++" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "sql", label: "SQL" }
];

import type { Difficulty } from "@/types/knowledge";

export const DIFFICULTIES: Array<{ value: Difficulty; label: string }> = [
  { value: "EASY", label: "Easy" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HARD", label: "Hard" }
];

export function difficultyLabel(value: Difficulty) {
  return DIFFICULTIES.find((item) => item.value === value)?.label ?? value;
}

export function difficultyBadgeClass(value: Difficulty) {
  switch (value) {
    case "EASY":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "HARD":
      return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300";
    default:
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }
}
