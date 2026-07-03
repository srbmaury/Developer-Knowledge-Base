export type SRGrade = "again" | "hard" | "good" | "easy";

const GRADE_SCORE: Record<SRGrade, number> = {
  again: 0,
  hard: 3,
  good: 4,
  easy: 5
};

export function computeNextSR(
  current: { interval: number; ease: number; reviews: number },
  grade: SRGrade
) {
  const q = GRADE_SCORE[grade];
  let { interval, ease } = current;
  const reviews = current.reviews + 1;

  if (q < 3) {
    interval = 1;
  } else {
    if (reviews === 1) interval = 1;
    else if (reviews === 2) interval = 6;
    else interval = Math.round(interval * ease);

    ease = Math.max(1.3, ease + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    ease = Math.round(ease * 100) / 100;
  }

  const due = new Date();
  due.setDate(due.getDate() + interval);
  due.setHours(4, 0, 0, 0); // due at 4am local time

  return { interval, ease, reviews, due: due.toISOString() };
}

export function isDue(srDue: string | null): boolean {
  if (!srDue) return true; // never reviewed
  return new Date(srDue) <= new Date();
}

export function daysUntilDue(srDue: string | null): number {
  if (!srDue) return 0;
  const diff = new Date(srDue).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
