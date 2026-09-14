import * as cheerio from "cheerio";
import type {
  ArticleIndexItem,
  FetchedHtml,
  HttpOptions,
} from "./types";

export const DEFAULT_TIMEOUT_MS = 10_000;
export const DEFAULT_RETRIES = 2;
export const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
export const DEFAULT_USER_AGENT =
  "csdn-importer/0.1 (+https://github.com/shiliu/personal-site)";
const MAX_REDIRECTS = 5;

const ARTICLE_DETAIL_RE = /\/article\/details\/(\d+)/i;
const ANCHOR_RE = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
const TAG_RE = /<\/?([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g;
const ATTRIBUTE_RE =
  /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

interface HiddenRange {
  start: number;
  end: number;
}

interface BusinessListEntry {
  articleId?: number | string;
  title?: string;
  description?: string;
  url?: string;
  postTime?: string;
  formatTime?: string;
  tags?: string[];
}

interface BusinessListResponse {
  code?: number;
  data?: {
    total?: number;
    list?: BusinessListEntry[];
  };
}

function selectArticleListHtml(html: string): string {
  const $ = cheerio.load(html);
  const containers = $(".blog-list-box");
  if (containers.length === 0) {
    return html;
  }
  return containers
    .toArray()
    .map((node) => $.html(node))
    .join("\n");
}

function selectPaginationHtml(html: string): string {
  const $ = cheerio.load(html);
  const containers = $(".item-loading");
  if (containers.length === 0) {
    return html;
  }
  return containers
    .toArray()
    .map((node) => $.html(node))
    .join("\n");
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
  };

  return value
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, body: string) => {
      const lower = body.toLowerCase();
      if (named[lower]) {
        return named[lower] ?? "";
      }
      if (lower.startsWith("#x")) {
        const codePoint = Number.parseInt(lower.slice(2), 16);
        return Number.isNaN(codePoint) ? "" : String.fromCodePoint(codePoint);
      }
      if (lower.startsWith("#")) {
        const codePoint = Number.parseInt(lower.slice(1), 10);
        return Number.isNaN(codePoint) ? "" : String.fromCodePoint(codePoint);
      }
      return entity;
    });
}

function stripTags(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, ""));
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function parseAttributes(raw: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  ATTRIBUTE_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = ATTRIBUTE_RE.exec(raw)) !== null) {
    const name = match[1]!.toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    attributes[name] = decodeHtmlEntities(value);
  }

  return attributes;
}

function isCsdnHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "csdn.net" || host.endsWith(".csdn.net");
}

function isHttpUrl(url: URL): boolean {
  return url.protocol === "http:" || url.protocol === "https:";
}

function assertCsdnHttpUrl(rawUrl: string, label: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL for ${label}: ${rawUrl}`);
  }

  if (!isHttpUrl(url)) {
    throw new Error(`Unsupported protocol for ${label}: ${url.protocol}`);
  }
  if (!isCsdnHost(url.hostname)) {
    throw new Error(
      `Host for ${label} must be csdn.net or a subdomain: ${url.hostname}`,
    );
  }

  url.hash = "";
  return url;
}

function normalizeStartUrl(startUrl: string): string {
  return assertCsdnHttpUrl(startUrl, "startUrl").toString();
}

function profileUsername(startUrl: string): string | null {
  const url = new URL(startUrl);
  const segments = url.pathname.split("/").filter(Boolean);
  if (
    segments.length !== 1 ||
    segments[0] === "community" ||
    segments[0] === "article"
  ) {
    return null;
  }
  return segments[0] ?? null;
}

function businessListUrl(username: string): string {
  return (
    "https://blog.csdn.net/community/home-api/v1/get-business-list" +
    `?page=1&size=100&businessType=blog&orderby=&noMore=false&year=&month=&username=${encodeURIComponent(username)}`
  );
}

function normalizeApiDate(value: string | undefined): string {
  return (value ?? "").replace(/\./g, "-").match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? "";
}

async function readLimitedText(
  response: Response,
  maxBytes: number,
  label: string,
): Promise<string> {
  const contentLength = response.headers?.get("content-length");
  const declaredSize = contentLength === null ? Number.NaN : Number(contentLength);
  if (Number.isFinite(declaredSize) && declaredSize > maxBytes) {
    throw new Error(`${label} size ${declaredSize} bytes exceeds limit ${maxBytes}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > maxBytes) {
      throw new Error(`${label} size exceeds limit ${maxBytes} bytes`);
    }
    return text;
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) {
      break;
    }
    if (!next.value) {
      continue;
    }
    total += next.value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`${label} size exceeds limit ${maxBytes} bytes`);
    }
    chunks.push(next.value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total).toString(
    "utf8",
  );
}

async function fetchCsdnText(
  url: string,
  options: HttpOptions,
  headers: Record<string, string>,
  label: string,
  signal?: AbortSignal,
): Promise<{ text: string; url: string }> {
  const fetchImpl = options.fetch ?? fetch;
  const maxBytes = assertNonNegativeInteger(
    options.maxBytes,
    "maxBytes",
    DEFAULT_MAX_BYTES,
  );
  let currentUrl = assertCsdnHttpUrl(url, label).toString();

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = await fetchImpl(currentUrl, {
      headers,
      redirect: "manual",
      signal,
    });

    if (response.status >= 300 && response.status < 400) {
      if (redirects === MAX_REDIRECTS) {
        throw new Error(`Too many redirects for ${url}`);
      }
      const location = response.headers.get("location");
      if (!location) {
        throw new Error(`Redirect missing location for ${currentUrl}`);
      }
      currentUrl = assertCsdnHttpUrl(
        new URL(location, currentUrl).toString(),
        "redirect",
      ).toString();
      continue;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }

    const finalRawUrl = response.url?.trim() ? response.url : currentUrl;
    const finalUrl = assertCsdnHttpUrl(finalRawUrl, "response.url");
    const text = await readLimitedText(response, maxBytes, label);
    return { text, url: finalUrl.toString() };
  }

  throw new Error(`Too many redirects for ${url}`);
}

export async function fetchBusinessListJson(
  url: string,
  referer: string,
  options: HttpOptions,
): Promise<string> {
  const timeoutMs = assertNonNegativeInteger(
    options.timeoutMs,
    "timeoutMs",
    DEFAULT_TIMEOUT_MS,
  );
  const retries = assertNonNegativeInteger(
    options.retries,
    "retries",
    DEFAULT_RETRIES,
  );
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const result = await fetchCsdnText(
        url,
        options,
        {
          accept: "application/json, text/plain, */*",
          referer,
          "user-agent":
            options.userAgent ??
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
        },
        "business API",
        controller.signal,
      );
      return result.text;
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function discoverFromBusinessApi(
  startUrl: string,
  options: HttpOptions,
): Promise<ArticleIndexItem[] | null> {
  const username = profileUsername(startUrl);
  if (username === null) {
    return null;
  }

  try {
    const json = await fetchBusinessListJson(
      businessListUrl(username),
      startUrl,
      options,
    );
    const response = JSON.parse(json) as BusinessListResponse;
    const entries = response.code === 200 ? response.data?.list : undefined;
    if (!Array.isArray(entries) || entries.length === 0) {
      return null;
    }

    const items: ArticleIndexItem[] = [];
    const seen = new Set<string>();
    for (const entry of entries) {
      const sourceId = String(entry.articleId ?? "").trim();
      const url = entry.url
        ? parseAllowedLink(entry.url, startUrl, true)
        : null;
      if (!/^\d+$/.test(sourceId) || url === null || seen.has(sourceId)) {
        continue;
      }
      seen.add(sourceId);
      items.push({
        url: url.toString(),
        sourceId,
        title: normalizeText(entry.title ?? "") || `文章 ${sourceId}`,
        category: normalizeText(entry.tags?.[0] ?? ""),
        publishedAt: normalizeApiDate(entry.postTime ?? entry.formatTime),
        summary: normalizeText(entry.description ?? ""),
      });
    }
    return items.length > 0 ? items : null;
  } catch {
    return null;
  }
}

function parseAllowedLink(
  rawHref: string,
  baseUrl: string,
  clearSearch: boolean,
): URL | null {
  try {
    const url = new URL(rawHref, baseUrl);
    if (!isHttpUrl(url) || !isCsdnHost(url.hostname)) {
      return null;
    }

    url.hash = "";
    if (clearSearch) {
      url.search = "";
    }
    return url;
  } catch {
    return null;
  }
}

function assertNonNegativeInteger(
  value: number | undefined,
  name: string,
  fallback: number,
): number {
  const resolved = value ?? fallback;
  if (
    !Number.isFinite(resolved) ||
    !Number.isInteger(resolved) ||
    resolved < 0
  ) {
    throw new Error(`${name} must be a finite non-negative integer`);
  }
  return resolved;
}

function isElementHidden(attributes: Record<string, string>): boolean {
  if (attributes.hidden !== undefined) {
    return true;
  }
  if ((attributes["aria-hidden"] ?? "").toLowerCase() === "true") {
    return true;
  }

  const style = (attributes.style ?? "").toLowerCase();
  if (
    style.includes("display:none") ||
    style.includes("display: none") ||
    style.includes("visibility:hidden") ||
    style.includes("visibility: hidden")
  ) {
    return true;
  }

  return /\b(?:hidden|hide)\b/.test((attributes.class ?? "").toLowerCase());
}

function findHiddenRanges(html: string): HiddenRange[] {
  const frames: Array<{ name: string; hidden: boolean; start: number }> = [];
  const ranges: HiddenRange[] = [];
  TAG_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = TAG_RE.exec(html)) !== null) {
    const name = match[1]!.toLowerCase();
    const closing = match[0].startsWith("</");

    if (closing) {
      for (let index = frames.length - 1; index >= 0; index -= 1) {
        const frame = frames.pop()!;
        if (frame.hidden) {
          ranges.push({
            start: frame.start,
            end: match.index + match[0].length,
          });
        }
        if (frame.name === name) {
          break;
        }
      }
      continue;
    }

    const attributes = parseAttributes(match[2] ?? "");
    frames.push({
      name,
      hidden: isElementHidden(attributes),
      start: match.index,
    });
  }

  for (const frame of frames) {
    if (frame.hidden) {
      ranges.push({ start: frame.start, end: html.length });
    }
  }

  return ranges;
}

function isInsideHiddenRange(index: number, ranges: HiddenRange[]): boolean {
  return ranges.some((range) => index >= range.start && index < range.end);
}

export async function fetchHtml(
  url: string,
  options: HttpOptions = {},
): Promise<FetchedHtml> {
  const timeoutMs = assertNonNegativeInteger(
    options.timeoutMs,
    "timeoutMs",
    DEFAULT_TIMEOUT_MS,
  );
  const retries = assertNonNegativeInteger(
    options.retries,
    "retries",
    DEFAULT_RETRIES,
  );
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const result = await fetchCsdnText(
        url,
        { ...options, fetch: options.fetch ?? fetch },
        {
          accept: "text/html,application/xhtml+xml",
          "user-agent": userAgent,
        },
        "HTML",
        controller.signal,
      );

      return { html: result.text, url: result.url };
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Failed to fetch ${url}: ${detail}`);
}

function extractArticleLinks(
  html: string,
  baseUrl: string,
  hiddenRanges: HiddenRange[],
): ArticleIndexItem[] {
  const items: ArticleIndexItem[] = [];
  ANCHOR_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = ANCHOR_RE.exec(html)) !== null) {
    const attributes = parseAttributes(match[1]!);
    const href = attributes.href;
    if (!href) {
      continue;
    }

    const sourceId = extractSourceId(href);
    if (sourceId === null) {
      continue;
    }
    if (
      isElementHidden(attributes) ||
      isInsideHiddenRange(match.index, hiddenRanges)
    ) {
      continue;
    }

    const url = parseAllowedLink(href, baseUrl, true);
    if (url === null) {
      continue;
    }

    const anchorText = normalizeText(stripTags(match[2] ?? ""));
    const title =
      anchorText || decodeHtmlEntities(attributes.title ?? "") || `CSDN ${sourceId}`;

    items.push({
      url: url.toString(),
      sourceId,
      title,
      category: attributes["data-category"] ?? "",
      publishedAt: attributes["data-published-at"] ?? "",
      summary: attributes["data-summary"] ?? "",
    });
  }

  return items;
}

function extractSourceId(href: string): string | null {
  const match = href.match(ARTICLE_DETAIL_RE);
  return match?.[1] ?? null;
}

function findPaginationLink(
  html: string,
  baseUrl: string,
  hiddenRanges: HiddenRange[],
): string | null {
  ANCHOR_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = ANCHOR_RE.exec(html)) !== null) {
    const attributes = parseAttributes(match[1]!);
    const href = attributes.href;
    if (!href) {
      continue;
    }
    if (
      isElementHidden(attributes) ||
      isInsideHiddenRange(match.index, hiddenRanges)
    ) {
      continue;
    }

    const text = normalizeText(stripTags(match[2] ?? ""));
    const label = `${text} ${attributes["aria-label"] ?? ""}`.toLowerCase();
    if (!label.includes("加载更多")) {
      continue;
    }

    const url = parseAllowedLink(href, baseUrl, false);
    if (url !== null) {
      return url.toString();
    }
  }

  return null;
}

export async function discoverArticleIndex(
  startUrl: string,
  options: HttpOptions = {},
): Promise<ArticleIndexItem[]> {
  const normalizedStartUrl = normalizeStartUrl(startUrl);
  const apiItems = await discoverFromBusinessApi(normalizedStartUrl, options);
  if (apiItems !== null) {
    return apiItems;
  }

  const seenPages = new Set<string>();
  const seenSourceIds = new Set<string>();
  const items: ArticleIndexItem[] = [];

  let currentUrl: string | null = normalizedStartUrl;

  while (currentUrl !== null && !seenPages.has(currentUrl)) {
    seenPages.add(currentUrl);
    const fetched = await fetchHtml(currentUrl, options);
    if (fetched.url !== currentUrl) {
      seenPages.add(fetched.url);
    }

    const articleListHtml = selectArticleListHtml(fetched.html);
    const hiddenRanges = findHiddenRanges(articleListHtml);
    const links = extractArticleLinks(
      articleListHtml,
      fetched.url,
      hiddenRanges,
    );

    if (links.length === 0) {
      throw new Error(`No article links found on ${fetched.url}`);
    }

    let added = 0;
    for (const link of links) {
      if (!seenSourceIds.has(link.sourceId)) {
        seenSourceIds.add(link.sourceId);
        items.push(link);
        added += 1;
      }
    }

    const paginationHtml = selectPaginationHtml(fetched.html);
    currentUrl =
      added === 0
        ? null
        : findPaginationLink(
            paginationHtml,
            fetched.url,
            findHiddenRanges(paginationHtml),
          );
  }

  return items;
}
