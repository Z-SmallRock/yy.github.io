import * as cheerio from "cheerio";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import type { Element } from "domhandler";
import type { SanitizedArticle } from "./types";

const ARTICLE_SELECTORS = ["#content_views", ".article_content", "#article_content", "article"];
const REMOVE_SELECTORS = [
  "script",
  "style",
  "iframe",
  "form",
  "button",
  "svg",
  "canvas",
  "noscript",
  "template",
  "header",
  "footer",
  "nav",
  "[hidden]",
  '[aria-hidden="true"]',
  ".recommend-box",
  ".comment-box",
  ".login-box",
  ".article-info-box",
  ".article-bar-top",
  ".copyright-box",
  ".article-copyright",
  ".opt-box",
  ".btn-code-notes",
  ".hljs-button",
  ".pre-numbering",
  ".toolbar",
  ".ad",
  ".ads",
  ".advertisement",
  ".avatar",
  ".user-avatar",
  ".tracking-pixel",
];
const SOURCE_BOILERPLATE_RE =
  /(?:^|\n)\s*(?:来源|原文链接|版权声明|本文链接)\s*[:：]?.*(?:csdn|转载|版权).*(?=\n|$)/giu;
const SOURCE_ELEMENT_RE =
  /(?:来源|原文链接|版权声明|本文链接|未经许可不得转载|转载请附上原文出处).*(?:csdn|转载|版权)/iu;

function cleanText(value: string): string {
  return value.replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim();
}

function firstContent($: cheerio.CheerioAPI): cheerio.Cheerio<Element> | null {
  for (const selector of ARTICLE_SELECTORS) {
    const candidate = $(selector).first();
    if (candidate.length > 0) {
      return candidate as cheerio.Cheerio<Element>;
    }
  }
  return null;
}

function metaContent($: cheerio.CheerioAPI, selector: string): string {
  return cleanText($(selector).first().attr("content") ?? "");
}

function dateOnly(value: string): string {
  const match = value.match(/\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? "";
}

function isCsdnUrl(rawUrl: string, sourceUrl: string): boolean {
  try {
    const url = new URL(rawUrl, sourceUrl);
    const hostname = url.hostname.toLowerCase();
    return hostname === "csdn.net" || hostname.endsWith(".csdn.net");
  } catch {
    return false;
  }
}

function createTurndownService(): TurndownService {
  const service = new TurndownService({
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
    headingStyle: "atx",
  });
  service.use(gfm);
  service.addRule("fencedCodeWithLanguage", {
    filter: (node) => node.nodeName === "PRE",
    replacement: (_content, node) => {
      const element = node as HTMLElement;
      const code = element.querySelector("code");
      const languageClass = code?.getAttribute("class")?.match(/(?:^|\s)language-([\w+-]+)/);
      const language = languageClass?.[1] ?? "";
      const value = (code?.textContent ?? element.textContent ?? "").replace(/\n+$/, "");
      return `\n\n\`\`\`${language}\n${value}\n\`\`\`\n\n`;
    },
  });
  return service;
}

function normalizeMarkdown(markdown: string): string {
  return markdown
    .split(/(```[\s\S]*?```)/g)
    .map((part) =>
      part.startsWith("```")
        ? part
        : part
            .replace(SOURCE_BOILERPLATE_RE, "\n")
            .replace(/^(\s*[-*+])\s{2,}/gm, "$1 ")
            .replace(/^(\s*\d+\.)\s{2,}/gm, "$1 ")
            .replace(/[ \t]+\n/g, "\n")
            .replace(/\n{3,}/g, "\n\n"),
    )
    .join("")
    .trim();
}

export function sanitizeArticleHtml(html: string, sourceUrl: string): SanitizedArticle {
  const $ = cheerio.load(html);
  const content = firstContent($);
  if (content === null) {
    throw new Error(`Article content container not found for ${sourceUrl}`);
  }

  content.find("*").each((_index, node) => {
    const element = $(node);
    const style = (element.attr("style") ?? "").toLowerCase();
    if (
      /display\s*:\s*none/.test(style) ||
      /visibility\s*:\s*hidden/.test(style)
    ) {
      element.remove();
    }
  });
  content.find(REMOVE_SELECTORS.join(",")).remove();
  content.find("p, div, aside").each((_index, node) => {
    const element = $(node);
    const hasBlockChildren =
      element.children("p, div, section, article, ul, ol, pre, table, blockquote")
        .length > 0;
    if (
      !hasBlockChildren &&
      SOURCE_ELEMENT_RE.test(cleanText(element.text()))
    ) {
      element.remove();
    }
  });
  content.find("*").each((_index, node) => {
    const element = $(node);
    for (const attribute of Object.keys(node.attribs ?? {})) {
      if (/^on/i.test(attribute) || attribute === "style") {
        element.removeAttr(attribute);
      }
    }
  });
  content.find("h1").each((_index, node) => {
    node.name = "h2";
  });
  content.find("*").contents().each((_index, node) => {
    if (node.type === "text" && node.data) {
      node.data = node.data.replace(/CSDN\s*(?:博客)?/gi, "");
    }
  });

  let sourceLinksRemoved = 0;
  content.find("a[href]").each((_index, node) => {
    const anchor = $(node);
    const href = anchor.attr("href") ?? "";
    if (isCsdnUrl(href, sourceUrl)) {
      sourceLinksRemoved += 1;
      anchor.replaceWith(anchor.contents());
      return;
    }
    try {
      const resolved = new URL(href, sourceUrl);
      if (resolved.protocol === "http:" || resolved.protocol === "https:") {
        anchor.attr("href", resolved.toString());
      } else {
        anchor.replaceWith(anchor.contents());
      }
    } catch {
      anchor.replaceWith(anchor.contents());
    }
  });

  content.find("img").each((_index, node) => {
    const image = $(node);
    const className = (image.attr("class") ?? "").toLowerCase();
    const width = Number.parseInt(image.attr("width") ?? "", 10);
    const height = Number.parseInt(image.attr("height") ?? "", 10);
    if (
      /\b(?:avatar|tracking|pixel)\b/.test(className) ||
      (Number.isFinite(width) &&
        Number.isFinite(height) &&
        width <= 1 &&
        height <= 1)
    ) {
      image.remove();
      return;
    }

    const src =
      image.attr("data-src") ??
      image.attr("data-original") ??
      image.attr("data-original-src") ??
      image.attr("src") ??
      "";
    try {
      const resolved = new URL(src, sourceUrl);
      if (resolved.protocol === "http:" || resolved.protocol === "https:") {
        image.attr("src", resolved.toString());
        image.removeAttr("data-src");
        image.removeAttr("data-original");
        image.removeAttr("data-original-src");
      } else {
        image.remove();
      }
    } catch {
      image.remove();
    }
  });

  const bodyText = cleanText(content.text());
  if (bodyText === "" && content.find("img").length === 0) {
    throw new Error(`Article content is empty for ${sourceUrl}`);
  }

  const rawTitle =
    cleanText($("h1.title-article").first().text()) ||
    cleanText($('meta[property="og:title"]').first().attr("content") ?? "") ||
    cleanText($("title").first().text());
  const title = rawTitle.replace(/\s*[-_]\s*CSDN.*$/i, "").trim() || "未命名文章";
  const publishedAt =
    dateOnly(metaContent($, 'meta[property="article:published_time"]')) ||
    dateOnly(cleanText($(".time").first().text())) ||
    "1970-01-01";
  const updatedAt =
    dateOnly(metaContent($, 'meta[property="article:modified_time"]')) || undefined;
  const category =
    cleanText($(".blog-tags-box a").first().text()) ||
    cleanText($('meta[property="article:section"]').first().attr("content") ?? "") ||
    "技术";
  const summary =
    metaContent($, 'meta[name="description"]') ||
    cleanText(content.find("p").first().text()).slice(0, 180) ||
    title;

  const markdownBody = normalizeMarkdown(createTurndownService().turndown(content.html() ?? ""));
  if (markdownBody === "") {
    throw new Error(`Article content is empty after sanitization for ${sourceUrl}`);
  }

  return {
    title,
    publishedAt,
    ...(updatedAt ? { updatedAt } : {}),
    category,
    summary,
    markdown: `# ${title}\n\n${markdownBody}\n`,
    sourceLinksRemoved,
  };
}
