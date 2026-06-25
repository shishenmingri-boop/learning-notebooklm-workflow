import path from "node:path";
import { readText } from "../../pinterest/lib/common.mjs";

/**
 * @param {string} filePath
 * @returns {{ slug: string, title: string, bodyMarkdown: string, bodyPlainText: string }}
 */
export function parseNoteFile(filePath) {
  const slug = path.basename(filePath, ".md");
  const raw = readText(filePath);
  const { bodyMarkdown, title } = extractTitleAndBody(raw);
  const bodyPlainText = markdownToPlainText(bodyMarkdown);

  return { slug, title, bodyMarkdown, bodyPlainText };
}

function extractTitleAndBody(raw) {
  const lines = raw.split(/\r?\n/);
  let title = "";
  let bodyStartIndex = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const headingMatch = line.match(/^#\s+(.+)$/);
    if (headingMatch) {
      title = headingMatch[1].trim();
      bodyStartIndex = index + 1;
      break;
    }
  }

  if (!title) {
    throw new Error("先頭に `# タイトル` 形式の見出しが必要です");
  }

  let bodyLines = lines.slice(bodyStartIndex);
  bodyLines = stripTrailingFooter(bodyLines);

  const bodyMarkdown = bodyLines.join("\n").trim();
  return { title, bodyMarkdown };
}

function stripTrailingFooter(lines) {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index].trim() === "---") {
      return lines.slice(0, index);
    }
  }
  return lines;
}

function markdownToPlainText(markdown) {
  return markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\|\s*[-| ]+\s*\|$/gm, "")
    .replace(/^\|\s*/gm, "")
    .replace(/\s*\|$/gm, "")
    .replace(/^[-*+]\s+/gm, "• ")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
