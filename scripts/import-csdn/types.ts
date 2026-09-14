export interface ArticleIndexItem {
  url: string;
  sourceId: string;
  title: string;
  category: string;
  publishedAt: string;
  summary: string;
}

export interface AssetRecord {
  sourceUrl: string;
  localPath: string;
  status: "downloaded" | "failed";
  error?: string;
}

export interface SanitizedArticle {
  title: string;
  publishedAt: string;
  updatedAt?: string;
  category: string;
  summary: string;
  markdown: string;
  sourceLinksRemoved: number;
}

export interface AssetDownloadResult {
  markdown: string;
  assets: AssetRecord[];
}

export interface ArticleDocument {
  sourceId: string;
  title: string;
  slug: string;
  category: string;
  publishedAt: string;
  updatedAt?: string;
  summary: string;
  readingTime: number;
  markdown: string;
  assets: AssetRecord[];
}

export interface RawArticle {
  url: string;
  html: string;
  title: string;
  contentHtml: string;
  publishedAt?: string;
  updatedAt?: string;
  category?: string;
  summary?: string;
}

export interface FetchedHtml {
  html: string;
  url: string;
}

export type ArticleTransform = (
  raw: RawArticle,
  item: ArticleIndexItem,
) => string | Promise<string>;

export interface FailureRecord {
  sourceId: string;
  url: string;
  sourceFile?: string;
  stage: string;
  message: string;
}

export interface AssetReport {
  sourceUrl: string;
  localPath?: string;
  status: string;
  message?: string;
}

export interface MigrationReport {
  startedAt: string;
  finishedAt: string;
  discovered: number;
  discoveredArticles?: ArticleIndexItem[];
  sourceDirectory?: string;
  removedCsdnReferences?: number;
  written: number;
  skipped: number;
  failures: FailureRecord[];
  assets: AssetReport[];
}

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface HttpOptions {
  timeoutMs?: number;
  retries?: number;
  maxBytes?: number;
  userAgent?: string;
  fetch?: FetchLike;
}

export interface AssetDownloadOptions extends HttpOptions {
  maxBytes?: number;
}
