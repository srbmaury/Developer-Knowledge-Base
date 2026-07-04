import { toast } from "sonner";
import { bulkImportAction, getExportContentAction } from "@/app/actions";
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
  const toastId = toast.loading("Preparing export…");
  try {
    const contentResult = await getExportContentAction();
    if (!contentResult.ok) {
      toast.error("Export failed — could not load solution content.", { id: toastId });
      return;
    }
    const contentMap = contentResult.content;

    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    const categoriesToExport = filterCategories(categories, options);

    function addCategory(cat: Category, parentPath: string) {
      const folderPath = parentPath ? `${parentPath}/${slugify(cat.name)}` : slugify(cat.name);
      for (const q of cat.questions) {
        // Format: # Title \n [description] [**Difficulty:**] [**Tags:**] --- \n [content]
        // Parser splits on the FIRST "---": everything before = meta, everything after = content.
        const lines: string[] = [];
        lines.push(`# ${q.title || "Untitled"}`);

        const content = contentMap[q.id] ?? "";
        const hasMeta = !!(q.description || q.difficulty || q.tags.length > 0);

        if (hasMeta) {
          if (q.description) { lines.push(""); lines.push(q.description); }
          if (q.difficulty) lines.push(`**Difficulty:** ${q.difficulty}`);
          if (q.tags.length > 0) lines.push(`**Tags:** ${q.tags.map((t) => t.name).join(", ")}`);
          lines.push("---");
          if (content) { lines.push(""); lines.push(content); }
        } else if (content) {
          lines.push(""); lines.push(content);
        }

        zip.file(`${folderPath}/${slugify(q.title || "untitled")}.md`, lines.join("\n"));
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
    toast.dismiss(toastId);
  } catch {
    toast.error("Export failed.", { id: toastId });
  }
}

type ImportNode = {
  name: string;
  questions: Array<{
    title: string;
    description: string;
    difficulty: Difficulty | null;
    content: string;
    tagNames: string[];
  }>;
  children: ImportNode[];
};

export async function importWorkspaceFromZip(file: File, refresh: () => void) {
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

    // Build tree: folder path → ImportNode, maintaining insertion order for correct child ordering
    const nodeByPath = new Map<string, ImportNode>();
    const rootNodes: ImportNode[] = [];

    for (const { pathParts } of mdEntries) {
      const folderParts = pathParts.slice(0, -1);
      for (let depth = 1; depth <= folderParts.length; depth++) {
        const path = folderParts.slice(0, depth).join("/");
        if (!nodeByPath.has(path)) {
          const node: ImportNode = { name: folderParts[depth - 1], questions: [], children: [] };
          nodeByPath.set(path, node);
          if (depth === 1) {
            rootNodes.push(node);
          } else {
            nodeByPath.get(folderParts.slice(0, depth - 1).join("/"))!.children.push(node);
          }
        }
      }
    }

    for (const { pathParts, rawContent } of mdEntries) {
      const folderParts = pathParts.slice(0, -1);
      if (folderParts.length === 0) continue; // skip root-level .md files
      const node = nodeByPath.get(folderParts.join("/"));
      if (!node) continue;
      node.questions.push(parseMarkdownFile(pathParts[pathParts.length - 1], rawContent));
    }

    if (rootNodes.length === 0) {
      toast.error("No categories found — organize notes into folders inside the zip.", { id: toastId });
      return;
    }

    toast.dismiss(toastId);
    const importId = toast.loading("Importing…", {
      description: "Large imports can take a minute. Please don't close the tab.",
    });

    const result = await bulkImportAction(rootNodes);
    toast.dismiss(importId);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success(
      `Imported ${result.questions} note${result.questions === 1 ? "" : "s"} in ${result.categories} categor${result.categories === 1 ? "y" : "ies"}`,
    );
    refresh();
  } catch (err) {
    console.error(err);
    toast.dismiss(toastId);
    toast.error("Failed to import zip");
  }
}
