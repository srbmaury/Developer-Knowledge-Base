import type { ActivityItem, Category, Question } from "@/types/knowledge";

function flattenQuestions(categories: Category[]): Question[] {
  return categories.flatMap((category) => [...category.questions, ...flattenQuestions(category.children)]);
}

export function buildRecentActivity(categories: Category[], limit = 5): ActivityItem[] {
  const events: ActivityItem[] = [];

  for (const question of flattenQuestions(categories)) {
    events.push({
      id: `question-${question.id}`,
      label: question.title.trim() ? `Updated ${question.title}` : "Updated question",
      detail: question.description.trim() || "No description",
      timestamp: question.updatedAt
    });

    for (const solution of question.solutions) {
      events.push({
        id: `solution-${solution.id}`,
        label: solution.title.trim() ? `Edited ${solution.title}` : "Edited approach",
        detail: question.title.trim() || "Untitled question",
        timestamp: solution.updatedAt
      });
    }
  }

  return events
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

export function resolveQuestionIdFromActivity(categories: Category[], activityId: string): string | null {
  if (activityId.startsWith("question-")) {
    return activityId.slice("question-".length);
  }

  if (activityId.startsWith("solution-")) {
    const solutionId = activityId.slice("solution-".length);
    for (const question of flattenQuestions(categories)) {
      if (question.solutions.some((solution) => solution.id === solutionId)) {
        return question.id;
      }
    }
  }

  return null;
}
