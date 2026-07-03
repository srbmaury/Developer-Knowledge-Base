import { toast } from "sonner";
import { getCategoryById, useWorkspaceStore } from "@/store/workspace-store";
import type { Category, Difficulty, QuestionStatus } from "@/types/knowledge";

export function slugify(name: string) {
  return name.replace(/[/\\?%*:|"<>]/g, "-").replace(/\s+/g, "-").replace(/-+/g, "-").trim();
}

export function parseMarkdownFile(
  filename: string,
  text: string
): { title: string; description: string; difficulty: Difficulty | null; tagNames: string[]; content: string } {
  const lines = text.split("\n");
  let title = filename.replace(/\.md$/i, "");
  let bodyStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (l.startsWith("# ")) { title = l.slice(2).trim(); bodyStart = i + 1; break; }
    if (l) break;
  }

  const body = lines.slice(bodyStart);
  const separatorIdx = body.findIndex((l) => l.trim() === "---");
  const metaLines = separatorIdx >= 0 ? body.slice(0, separatorIdx) : [];
  const contentLines = separatorIdx >= 0 ? body.slice(separatorIdx + 1) : body;

  let difficulty: Difficulty | null = null;
  let tagNames: string[] = [];
  const descLines: string[] = [];

  for (const line of metaLines) {
    const trimmed = line.trim();
    const diffMatch = trimmed.match(/^\*\*Difficulty:\*\*\s*(.+)/i);
    if (diffMatch) {
      const val = diffMatch[1].trim().toUpperCase();
      if (val === "EASY" || val === "MEDIUM" || val === "HARD") difficulty = val as Difficulty;
      continue;
    }
    const tagMatch = trimmed.match(/^\*\*Tags:\*\*\s*(.+)/i);
    if (tagMatch) {
      tagNames = tagMatch[1].split(",").map((t) => t.trim()).filter(Boolean);
      continue;
    }
    descLines.push(line);
  }

  return {
    title,
    description: descLines.join("\n").trim(),
    difficulty,
    tagNames,
    content: contentLines.join("\n").trimStart(),
  };
}

type ExportFilterOptions = {
  selectedCategoryId?: string | null;
  filterStatus?: QuestionStatus | null;
  filterTagIds?: string[];
};

function filterCategories(categories: Category[], options: ExportFilterOptions): Category[] {
  return categories.flatMap((category) => {
    const filteredChildren = filterCategories(category.children, options);
    const filteredQuestions = category.questions.filter((question) => {
      if (options.selectedCategoryId && question.categoryId !== options.selectedCategoryId) return false;
      if (options.filterStatus && (question.status ?? "NOT_STARTED") !== options.filterStatus) return false;
      if (options.filterTagIds?.length && !options.filterTagIds.every((id) => question.tags.some((tag) => tag.id === id))) return false;
      return true;
    });

    if (filteredQuestions.length === 0 && filteredChildren.length === 0) return [];

    return [{ ...category, questions: filteredQuestions, children: filteredChildren }];
  });
}

export async function exportWorkspaceToZip(categories: Category[], options: ExportFilterOptions = {}) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const categoriesToExport = filterCategories(categories, options);

  function addCategory(cat: Category, parentPath: string) {
    const folderPath = parentPath ? `${parentPath}/${slugify(cat.name)}` : slugify(cat.name);
    for (const q of cat.questions) {
      const parts: string[] = [];
      parts.push(`# ${q.title || "Untitled"}`);
      if (q.description) parts.push(`\n${q.description}`);
      if (q.difficulty || q.tags.length > 0) {
        parts.push("\n---");
        if (q.difficulty) parts.push(`**Difficulty:** ${q.difficulty}`);
        if (q.tags.length > 0) parts.push(`**Tags:** ${q.tags.map((t) => t.name).join(", ")}`);
        parts.push("---");
      }
      const content = q.solutions?.[0]?.content ?? "";
      if (content) parts.push(`\n${content}`);
      zip.file(`${folderPath}/${slugify(q.title || "untitled")}.md`, parts.join("\n"));
    }
    for (const child of cat.children) addCategory(child, folderPath);
  }

  for (const cat of categoriesToExport) addCategory(cat, "");

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "knowledge-base.zip";
  a.click();
  URL.revokeObjectURL(url);
}

export async function importWorkspaceFromZip(file: File) {
  const toastId = toast.loading("Reading zip…");
  try {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(file);

    const mdEntries: Array<{ pathParts: string[]; rawContent: string }> = [];
    await Promise.all(
      Object.entries(zip.files).map(async ([zipPath, entry]) => {
        if (entry.dir || !zipPath.toLowerCase().endsWith(".md")) return;
        const rawContent = await entry.async("text");
        mdEntries.push({ pathParts: zipPath.split("/").filter(Boolean), rawContent });
      })
    );

    if (mdEntries.length === 0) {
      toast.error("No markdown files found in zip", { id: toastId });
      return;
    }

    // Build unique folder paths sorted shallowest-first so parents are created before children
    const folderPathSet = new Set<string>();
    for (const { pathParts } of mdEntries) {
      const folderParts = pathParts.slice(0, -1);
      for (let i = 1; i <= folderParts.length; i++) {
        folderPathSet.add(folderParts.slice(0, i).join("/"));
      }
    }
    const sortedFolders = [...folderPathSet].sort(
      (a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b)
    );

    const pathToId = new Map<string, string>();
    for (const folderPath of sortedFolders) {
      const parts = folderPath.split("/");
      const name = parts[parts.length - 1];
      const parentPath = parts.slice(0, -1).join("/");
      const parentId = parentPath ? (pathToId.get(parentPath) ?? null) : null;

      const state = useWorkspaceStore.getState();
      const siblings = parentId
        ? getCategoryById(state.categories, parentId)?.children ?? []
        : state.categories;
      const existing = siblings.find((c) => c.name === name);

      if (existing) {
        pathToId.set(folderPath, existing.id);
      } else {
        await state.addCategory(name, parentId);
        const newId = useWorkspaceStore.getState().selectedCategoryId;
        if (newId) pathToId.set(folderPath, newId);
      }
    }

    let created = 0;
    for (const { pathParts, rawContent } of mdEntries) {
      const folderParts = pathParts.slice(0, -1);
      const filename = pathParts[pathParts.length - 1];
      const folderPath = folderParts.join("/");
      const categoryId = folderPath ? pathToId.get(folderPath) : null;
      if (!categoryId) continue;

      const { title, description, difficulty, tagNames, content } = parseMarkdownFile(filename, rawContent);
      await useWorkspaceStore.getState().addQuestion(categoryId, title);

      const s = useWorkspaceStore.getState();
      const questionId = s.selectedQuestionId;
      const solutionId = s.selectedSolutionId;

      if (questionId && !questionId.startsWith("temp-")) {
        if (description) s.updateQuestionDescription(questionId, description);
        if (difficulty) s.updateQuestionDifficulty(questionId, difficulty);
        for (const tagName of tagNames) {
          const tag = s.allTags.find((t) => t.name.toLowerCase() === tagName.toLowerCase());
          if (tag) s.addTagToQuestion(questionId, tag.id);
        }
      }
      if (solutionId && !solutionId.startsWith("temp-")) {
        s.updateSolutionContent(solutionId, content);
      }
      created++;
    }

    toast.success(`Imported ${created} note${created === 1 ? "" : "s"}`, { id: toastId });
  } catch {
    toast.error("Failed to import zip", { id: toastId });
  }
}
