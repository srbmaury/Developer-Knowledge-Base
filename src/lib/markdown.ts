/** True when content was saved from the legacy HTML editor. */
export function isLikelyHtml(content: string) {
  const trimmed = content.trim();
  return trimmed.startsWith("<") && /<\/[a-z][\s\S]*>/i.test(trimmed);
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
  text = text.replace(/```([a-zA-Z0-9+#-]*)([^\n\r`])/g, "```$1\n$2");

  // Split jammed comment lines: "// foo// bar" -> two lines
  text = text.replace(/(\/\/[^\n]*?)(\/\/)/g, "$1\n$2");

  // Blank line before fenced blocks for readability
  text = text.replace(/([^\n])\n(```)/g, "$1\n\n$2");

  return text.trim();
}
