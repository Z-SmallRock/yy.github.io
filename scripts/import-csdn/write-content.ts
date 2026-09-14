import {
  mkdir,
  readFile,
  readdir,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import type { ArticleDocument } from "./types";

const HAN_CHAR_RE = /\p{Script=Han}/gu;
const FENCED_CODE_RE = /```[^\n]*\n([\s\S]*?)```/g;

export function slugifyTitle(title: string): string {
  const slug = title
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return slug || "article";
}

export function calculateReadingTime(markdown: string): number {
  const codeParts: string[] = [];
  FENCED_CODE_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = FENCED_CODE_RE.exec(markdown)) !== null) {
    codeParts.push(match[1] ?? "");
  }

  const bodyWithoutCode = markdown.replace(FENCED_CODE_RE, "");
  const hanCount = (bodyWithoutCode.match(HAN_CHAR_RE) ?? []).length;
  const codeCount = codeParts.join("").replace(/\s/g, "").length;

  return Math.max(1, Math.ceil((hanCount + codeCount) / 400));
}

type ExistingArticle =
  | { status: "missing" }
  | { status: "no-source" }
  | { status: "owned"; sourceId: string };

async function inspectExistingArticle(
  filePath: string,
): Promise<ExistingArticle> {
  try {
    const source = await readFile(filePath, "utf8");
    const parsed = matter(source);
    const value = parsed.data?.sourceId;
    if (typeof value === "string" && value.trim() !== "") {
      return { status: "owned", sourceId: value.trim() };
    }
    if (typeof value === "number") {
      return { status: "owned", sourceId: String(value) };
    }
    return { status: "no-source" };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { status: "missing" };
    }
    throw error;
  }
}

function assertRequestedSlug(document: ArticleDocument, baseSlug: string): string {
  const requested = document.slug.trim();
  if (
    requested !== "" &&
    !/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u.test(requested)
  ) {
    throw new Error(`Invalid slug "${document.slug}": path separators are not allowed`);
  }
  return requested || baseSlug;
}

async function resolveSlug(
  document: ArticleDocument,
  articlesDir: string,
): Promise<string> {
  const baseSlug = slugifyTitle(document.title);
  const requestedSlug = assertRequestedSlug(document, baseSlug);
  const requestedPath = path.join(articlesDir, `${requestedSlug}.md`);
  const existing = await inspectExistingArticle(requestedPath);

  if (
    existing.status === "missing" ||
    (existing.status === "owned" && existing.sourceId === document.sourceId)
  ) {
    return requestedSlug;
  }
  if (existing.status === "no-source") {
    throw new Error(
      `Refusing to overwrite article with slug "${requestedSlug}" because it has no sourceId`,
    );
  }

  const collisionSlug = `${requestedSlug}-${document.sourceId}`;
  const collisionPath = path.join(articlesDir, `${collisionSlug}.md`);
  const collision = await inspectExistingArticle(collisionPath);

  if (
    collision.status === "missing" ||
    (collision.status === "owned" && collision.sourceId === document.sourceId)
  ) {
    return collisionSlug;
  }
  if (collision.status === "no-source") {
    throw new Error(
      `Refusing to overwrite article with slug "${collisionSlug}" because it has no sourceId`,
    );
  }

  throw new Error(
    `Refusing to overwrite article with slug "${collisionSlug}" owned by source ${collision.sourceId}`,
  );
}

async function findArticlesOwnedBySource(
  articlesDir: string,
  sourceId: string,
): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(articlesDir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const owned: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !/\.(md|mdx)$/i.test(entry.name)) {
      continue;
    }
    const filePath = path.join(articlesDir, entry.name);
    const existing = await inspectExistingArticle(filePath);
    if (
      existing.status === "owned" &&
      existing.sourceId === sourceId
    ) {
      owned.push(filePath);
    }
  }
  return owned;
}

function serializeArticle(document: ArticleDocument, slug: string): string {
  const data = {
    title: document.title,
    slug,
    publishedAt: document.publishedAt,
    ...(document.updatedAt ? { updatedAt: document.updatedAt } : {}),
    category: document.category,
    summary: document.summary,
    readingTime: document.readingTime,
    sourceId: document.sourceId,
  };

  return matter.stringify(document.markdown, data);
}

export async function writeArticle(
  document: ArticleDocument,
  rootDir: string,
  contentDir?: string,
): Promise<string> {
  const articlesDir = contentDir
    ? path.resolve(rootDir, contentDir)
    : path.join(rootDir, "src", "content", "articles");
  await mkdir(articlesDir, { recursive: true });

  const previousPaths = await findArticlesOwnedBySource(
    articlesDir,
    document.sourceId,
  );
  const slug = await resolveSlug(document, articlesDir);
  const filePath = path.join(articlesDir, `${slug}.md`);
  const content = serializeArticle(document, slug);

  await writeFile(filePath, content, "utf8");
  await Promise.all(
    previousPaths
      .filter((previousPath) => previousPath !== filePath)
      .map((previousPath) => unlink(previousPath)),
  );
  return filePath;
}
