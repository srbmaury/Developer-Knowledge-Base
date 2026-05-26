/** True when content was saved from the legacy HTML editor. */
export function isLikelyHtml(content: string) {
  const trimmed = content.trim();

  // Detect actual HTML tags, not markdown that happens to start with "<".
  // Heuristics:
  // - starts with an element tag
  // - includes at least one closing tag
  // - doesn't look like escaped HTML (e.g. "<div>")
  if (!trimmed.startsWith("<")) return false;
  if (trimmed.includes("<") || trimmed.includes(">")) return false;

  const hasOpeningTag = /^<\s*([a-zA-Z][a-zA-Z0-9:-]*)\b/.test(trimmed);
  if (!hasOpeningTag) return false;

  // At least one closing tag: </tag>
  const hasClosingTag = /<\/[a-zA-Z][a-zA-Z0-9:-]*\b[^>]*>/i.test(trimmed);
  if (!hasClosingTag) return false;

  return true;
}


/** Strip wrappers and fix common GPT formatting issues in markdown. */
export function normalizeGeneratedMarkdown(raw: string) {
  let text = raw.trim();

  if (text.startsWith("```markdown")) {
    text = text.replace(/^```markdown\s*\n?/i, "").replace(/\n?```\s*$/i, "");
  } else if (text.startsWith("```md")) {
    text = text.replace(/^```md\s*\n?/i, "").replace(/\n?```\s*$/i, "");
  } else if (text.startsWith("```") && text.endsWith("```")) {
    text = text.replace(/^```[\w-]*\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  text = text.trim();

  // Ensure newline after opening code fence when model omits it (e.g. ```typescript// comment)
  text = text.replace(/```([a-zA-Z0-9+#-]+)[ \t]+([^\n\r`])/g, "```$1\n$2",);

  // Split jammed comment lines: "// foo// bar" -> two lines
  text = text.replace(/(\/\/[^\n]*?)(\/\/)/g, "$1\n$2");

  // Blank line before fenced blocks for readability
  text = text.replace(/([^\n])\n(```)/g, "$1\n\n$2");

  return text.trim();
}
