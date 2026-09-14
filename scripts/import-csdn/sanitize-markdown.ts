const ZERO_WIDTH_RE = /[\u200B-\u200D\u2060\uFEFF]/g;
const DATA_GIF_MARKDOWN_RE =
  /!\[[^\]]*\]\(\s*data:image\/gif(?:;[^)]*)?\)/giu;
const DATA_GIF_HTML_RE =
  /<img\b[^>]*\bsrc\s*=\s*(?:"data:image\/gif[^"]*"|'data:image\/gif[^']*'|data:image\/gif[^\s>]*)[^>]*>/giu;
const MARKDOWN_LINK_RE =
  /(?<!!)\[([^\]]*)\]\((https?:\/\/[^\s)]+)(?:\s+["'][^"']*["'])?\)/giu;
const AUTOLINK_RE = /<(https?:\/\/[^>]+)>/giu;
const BARE_CSDN_URL_RE =
  /https?:\/\/(?:[a-z0-9-]+\.)*csdn\.net\/[^\s)>\]]*/giu;
const IMAGE_EDITOR_MARKER_RE =
  /(!\[[^\]\n]*\]\([^\n]+\))[ \t]*编辑(?=[ \t]*(?:\n|$))/giu;
const EMPTY_BOLD_LINK_RE = /\*\*\[\]\([^)\n]+\)\*\*/giu;
const EMPTY_LINK_RE = /(?<!!)\[\]\([^)\n]+\)/giu;
const PLATFORM_LINE_PATTERNS = [
  /^\s*编辑\s*$/iu,
  /^\s*点击并拖拽以移动\s*$/iu,
  /^\s*CSDN\s*(?:博客)?\s*$/iu,
  /^\s*(?:原文链接|本文链接|版权声明|来源)\s*[:：]?.*csdn.*$/iu,
  /^\s*文章知识点与官方知识档案匹配.*$/iu,
  /^\s*下载资源.*csdn.*$/iu,
];

function isCsdnUrl(rawUrl: string): boolean {
  try {
    const host = new URL(rawUrl).hostname.toLowerCase();
    return host === "csdn.net" || host.endsWith(".csdn.net");
  } catch {
    return false;
  }
}

function normalizeTitle(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/^[#\s]+/, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function removeLeadingTitle(markdown: string, title: string): string {
  const lines = markdown.split("\n");
  const firstContentIndex = lines.findIndex((line) => line.trim() !== "");
  if (firstContentIndex < 0) {
    return "";
  }

  const firstLine = lines[firstContentIndex]!;
  const heading = firstLine.match(/^\s*#\s+(.+?)\s*$/);
  if (
    heading &&
    (normalizeTitle(heading[1] ?? "") === normalizeTitle(title) ||
      firstContentIndex === 0)
  ) {
    lines.splice(firstContentIndex, 1);
  }
  return lines.join("\n");
}

function removePlatformResidue(markdown: string): string {
  return markdown
    .replace(IMAGE_EDITOR_MARKER_RE, "$1")
    .replace(EMPTY_BOLD_LINK_RE, "")
    .replace(EMPTY_LINK_RE, "")
    .replace(MARKDOWN_LINK_RE, (match, label: string, url: string) =>
      isCsdnUrl(url) ? label.trim() : match,
    )
    .replace(AUTOLINK_RE, (match, url: string) =>
      isCsdnUrl(url) ? "" : match,
    )
    .split("\n")
    .filter((line) => {
      if (PLATFORM_LINE_PATTERNS.some((pattern) => pattern.test(line))) {
        return false;
      }
      const withoutBareUrl = line.replace(BARE_CSDN_URL_RE, "").trim();
      return withoutBareUrl !== "" || line.trim() === "";
    })
    .map((line) => line.replace(BARE_CSDN_URL_RE, ""))
    .join("\n");
}

function normalizeMarkdownStructure(markdown: string): string {
  const output: string[] = [];
  let inFence = false;
  let previousBlank = true;

  for (const rawLine of markdown.split("\n")) {
    const fence = /^\s*```/.test(rawLine);
    const line = inFence ? rawLine : rawLine.replace(/[ \t]+$/g, "");
    const blank = line.trim() === "";

    if (fence) {
      inFence = !inFence;
    }
    if (blank && !inFence) {
      if (!previousBlank && output.length > 0) {
        output.push("");
      }
      previousBlank = true;
      continue;
    }

    output.push(line);
    previousBlank = false;
  }

  while (output.at(-1) === "") {
    output.pop();
  }
  if (inFence) {
    output.push("```");
  }
  return output.length === 0 ? "" : `${output.join("\n")}\n`;
}

export function sanitizeLocalMarkdown(
  markdown: string,
  title: string,
): string {
  const normalized = markdown
    .replace(/\r\n?/g, "\n")
    .replace(ZERO_WIDTH_RE, "")
    .replace(/\u00A0/g, " ");
  const withoutPlaceholders = normalized
    .replace(DATA_GIF_MARKDOWN_RE, "")
    .replace(DATA_GIF_HTML_RE, "");
  const withoutPlatformResidue = removePlatformResidue(withoutPlaceholders);
  const withoutDuplicateTitle = removeLeadingTitle(
    withoutPlatformResidue,
    title,
  );
  return normalizeMarkdownStructure(withoutDuplicateTitle);
}
