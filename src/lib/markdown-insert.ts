export type MarkdownInsertAction =
  | "h1"
  | "h2"
  | "h3"
  | "bullet"
  | "ordered"
  | "bold"
  | "italic"
  | "code"
  | "codeBlock"
  | "quote"
  | "link"
  | "hr";

type InsertResult = {
  next: string;
  selectionStart: number;
  selectionEnd: number;
};

function lineRange(text: string, start: number, end: number) {
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const lineEndIndex = text.indexOf("\n", end);
  const lineEnd = lineEndIndex === -1 ? text.length : lineEndIndex;
  return { lineStart, lineEnd };
}

function prefixLines(text: string, start: number, end: number, prefix: string, ordered = false): InsertResult {
  const { lineStart, lineEnd } = lineRange(text, start, end);
  const block = text.slice(lineStart, lineEnd);
  const lines = block.split("\n");
  let index = 1;
  const nextLines = lines.map((line) => {
    const trimmed = line.replace(/^\s+/, "");
    const existing = trimmed.match(/^(#{1,6}\s+|[-*+]\s+|\d+\.\s+|>\s+)/);
    const body = existing ? trimmed.slice(existing[0].length) : trimmed;
    const itemPrefix = ordered ? `${index++}. ` : prefix;
    return `${itemPrefix}${body}`;
  });
  const nextBlock = nextLines.join("\n");
  const next = text.slice(0, lineStart) + nextBlock + text.slice(lineEnd);
  return { next, selectionStart: lineStart, selectionEnd: lineStart + nextBlock.length };
}

function wrapSelection(text: string, start: number, end: number, before: string, after: string, placeholder: string): InsertResult {
  const selected = text.slice(start, end) || placeholder;
  const next = text.slice(0, start) + before + selected + after + text.slice(end);
  const selectionStart = start + before.length;
  const selectionEnd = selectionStart + selected.length;
  return { next, selectionStart, selectionEnd };
}

export function applyMarkdownInsert(
  text: string,
  start: number,
  end: number,
  action: MarkdownInsertAction,
  language = "typescript"
): InsertResult {
  const lang = language && language !== "none" ? language : "";

  switch (action) {
    case "h1":
      return prefixLines(text, start, end, "# ");
    case "h2":
      return prefixLines(text, start, end, "## ");
    case "h3":
      return prefixLines(text, start, end, "### ");
    case "bullet":
      return prefixLines(text, start, end, "- ");
    case "ordered":
      return prefixLines(text, start, end, "", true);
    case "bold":
      return wrapSelection(text, start, end, "**", "**", "bold text");
    case "italic":
      return wrapSelection(text, start, end, "*", "*", "italic text");
    case "code":
      return wrapSelection(text, start, end, "`", "`", "code");
    case "codeBlock": {
      const selected = text.slice(start, end) || "// your code here";
      const fence = lang ? `\`\`\`${lang}\n` : "```\n";
      const block = `${fence}${selected}\n\`\`\``;
      const next = text.slice(0, start) + block + text.slice(end);
      const selectionStart = start + fence.length;
      const selectionEnd = selectionStart + selected.length;
      return { next, selectionStart, selectionEnd };
    }
    case "quote":
      return prefixLines(text, start, end, "> ");
    case "link": {
      const selected = text.slice(start, end) || "link text";
      const snippet = `[${selected}](url)`;
      const next = text.slice(0, start) + snippet + text.slice(end);
      const urlStart = start + selected.length + 3;
      return { next, selectionStart: urlStart, selectionEnd: urlStart + 3 };
    }
    case "hr": {
      const snippet = "\n\n---\n\n";
      const next = text.slice(0, end) + snippet + text.slice(end);
      const cursor = end + snippet.length;
      return { next, selectionStart: cursor, selectionEnd: cursor };
    }
    default:
      return { next: text, selectionStart: start, selectionEnd: end };
  }
}
