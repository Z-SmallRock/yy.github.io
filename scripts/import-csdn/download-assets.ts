import { createHash } from "node:crypto";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type {
  AssetDownloadOptions,
  AssetDownloadResult,
  AssetRecord,
} from "./types";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_MAX_BYTES = 20 * 1024 * 1024;
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (compatible; shiliu-content-migrator/1.0)";
const MAX_REDIRECTS = 5;
const ALLOWED_IMAGE_HOSTS = new Set([
  "i-blog.csdnimg.cn",
  "img-blog.csdnimg.cn",
  "img-blog.csdn.net",
]);
const MARKDOWN_IMAGE_RE = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)(?:\s+["'][^"']*["'])?\)/gi;
const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function assertNonNegativeInteger(value: number | undefined, fallback: number, name: string): number {
  const resolved = value ?? fallback;
  if (!Number.isFinite(resolved) || !Number.isInteger(resolved) || resolved < 0) {
    throw new Error(`${name} must be a finite non-negative integer`);
  }
  return resolved;
}

function safeSlug(slug: string): string {
  if (!slug || slug.includes("/") || slug.includes("\\") || slug.includes("..")) {
    throw new Error(`Invalid asset slug: ${slug}`);
  }
  return slug;
}

function imageUrls(markdown: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  MARKDOWN_IMAGE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MARKDOWN_IMAGE_RE.exec(markdown)) !== null) {
    const value = match[2]!;
    if (!seen.has(value)) {
      seen.add(value);
      urls.push(value);
    }
  }
  return urls;
}

function removeImageReference(markdown: string, sourceUrl: string): string {
  const pattern = new RegExp(
    `!\\[([^\\]]*)\\]\\(${escapeRegExp(sourceUrl)}(?:\\s+["'][^"']*["'])?\\)`,
    "gi",
  );
  return markdown
    .replace(pattern, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

function allowedImageUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid image URL: ${rawUrl}`);
  }
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    !ALLOWED_IMAGE_HOSTS.has(url.hostname.toLowerCase())
  ) {
    throw new Error(`Image host is not allowed: ${url.hostname || rawUrl}`);
  }
  return url;
}

async function readLimitedBody(
  response: Response,
  maxBytes: number,
): Promise<Buffer> {
  const reader = response.body?.getReader();
  if (!reader) {
    return Buffer.alloc(0);
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
      throw new Error(`Image size exceeds limit ${maxBytes} bytes`);
    }
    chunks.push(next.value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total);
}

async function fetchImage(sourceUrl: string, options: AssetDownloadOptions): Promise<Buffer> {
  const fetchImpl = options.fetch ?? fetch;
  const timeoutMs = assertNonNegativeInteger(options.timeoutMs, DEFAULT_TIMEOUT_MS, "timeoutMs");
  const retries = assertNonNegativeInteger(options.retries, DEFAULT_RETRIES, "retries");
  const maxBytes = assertNonNegativeInteger(options.maxBytes, DEFAULT_MAX_BYTES, "maxBytes");
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      let currentUrl = allowedImageUrl(sourceUrl);
      let response: Response | null = null;
      for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
        response = await fetchImpl(currentUrl, {
          headers: {
            accept: "image/avif,image/webp,image/png,image/jpeg,image/gif,*/*;q=0.1",
            "user-agent": options.userAgent ?? DEFAULT_USER_AGENT,
          },
          redirect: "manual",
          signal: controller.signal,
        });
        if (response.status < 300 || response.status >= 400) {
          break;
        }
        if (redirects === MAX_REDIRECTS) {
          throw new Error(`Too many redirects for ${sourceUrl}`);
        }
        const location = response.headers.get("location");
        if (!location) {
          throw new Error(`Redirect missing location for ${currentUrl}`);
        }
        currentUrl = allowedImageUrl(new URL(location, currentUrl).toString());
      }
      if (response === null) {
        throw new Error(`No response for ${sourceUrl}`);
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${sourceUrl}`);
      }
      const contentType = (response.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
      if (!contentType.startsWith("image/")) {
        throw new Error(`Rejected content-type "${contentType || "missing"}" for ${sourceUrl}`);
      }
      const contentLength = response.headers.get("content-length");
      const declaredSize = contentLength === null ? Number.NaN : Number(contentLength);
      if (Number.isFinite(declaredSize) && declaredSize > maxBytes) {
        throw new Error(`Image size ${declaredSize} bytes exceeds limit ${maxBytes}`);
      }
      return await readLimitedBody(response, maxBytes);
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(lastError instanceof Error ? lastError.message : String(lastError));
}

export async function downloadArticleAssets(
  markdown: string,
  slug: string,
  publicDir: string,
  options: AssetDownloadOptions = {},
): Promise<AssetDownloadResult> {
  const articleSlug = safeSlug(slug);
  const urls = imageUrls(markdown);
  let rewritten = markdown;
  const assets: AssetRecord[] = [];

  for (const sourceUrl of urls) {
    const filename = `${createHash("sha256").update(sourceUrl).digest("hex").slice(0, 20)}.webp`;
    const publicPath = `/images/articles/${articleSlug}/${filename}`;
    const outputDir = path.resolve(publicDir, "images", "articles", articleSlug);
    const outputPath = path.join(outputDir, filename);
    try {
      await mkdir(outputDir, { recursive: true });
      try {
        await access(outputPath);
      } catch {
        const input = await fetchImage(sourceUrl, options);
        const converted = await sharp(input, { animated: true }).webp({ quality: 86 }).toBuffer();
        await writeFile(outputPath, converted, { flag: "wx" }).catch(async (error: unknown) => {
          if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
            throw error;
          }
        });
      }
      rewritten = rewritten.split(sourceUrl).join(publicPath);
      assets.push({ sourceUrl, localPath: publicPath, status: "downloaded" });
    } catch (error) {
      rewritten = removeImageReference(rewritten, sourceUrl);
      assets.push({
        sourceUrl,
        localPath: "",
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { markdown: rewritten, assets };
}
