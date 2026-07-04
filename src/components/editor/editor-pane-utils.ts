import { getAllQuestions } from "@/store/workspace-store";
import type { Category, Question, Solution } from "@/types/knowledge";

export function isNewQuestion(question: Question, solution: Solution) {
  return question.title.trim() === "" && solution.content.trim() === "";
}

export function computeBacklinks(categories: Category[], questionId: string): Question[] {
  const allQ = getAllQuestions(categories);
  const target = allQ.find((q) => q.id === questionId);
  if (!target || !target.title.trim()) return [];
  const escaped = target.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\[\\[${escaped}\\]\\]`, "i");
  return allQ.filter((q) => {
    if (q.id === questionId) return false;
    const haystack = [q.description, ...q.solutions.map((s) => s.content + " " + s.notes)].join(" ");
    return pattern.test(haystack);
  });
}

export function flattenCategoriesWithPath(cats: Category[], parentPath = ""): Array<{ id: string; name: string; path: string; canEdit: boolean }> {
  return cats.flatMap((cat) => {
    const path = parentPath ? `${parentPath} / ${cat.name}` : cat.name;
    return [{ id: cat.id, name: cat.name, path: parentPath, canEdit: cat.canEdit }, ...flattenCategoriesWithPath(cat.children, path)];
  });
}

export function exportQuestionToMarkdown(question: Question) {
  const lines: string[] = [`# ${question.title || "Untitled question"}`, ""];
  if (question.description) {
    lines.push(question.description, "");
  }
  const meta: string[] = [`**Difficulty:** ${question.difficulty}`];
  if (question.tags.length > 0) meta.push(`**Tags:** ${question.tags.map((t) => t.name).join(", ")}`);
  lines.push(...meta, "");

  for (const sol of question.solutions) {
    lines.push("---", "", `## ${sol.title}`, "");
    if (sol.content) { lines.push(sol.content, ""); }
    if (sol.notes) { lines.push("### Notes", "", sol.notes, ""); }
  }

  const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(question.title || "note").replace(/[/\\?%*:|"<>]/g, "-")}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
