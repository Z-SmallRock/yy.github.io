import path from "node:path";
import { fileURLToPath } from "node:url";
import { discoverArticleIndex } from "./discover";
import { downloadArticleAssets } from "./download-assets";
import { fetchArticle } from "./fetch-article";
import { writeMigrationReport } from "./report";
import { sanitizeArticleHtml } from "./sanitize-html";
import type {
  ArticleDocument,
  ArticleIndexItem,
  ArticleTransform,
  HttpOptions,
  MigrationReport,
  RawArticle,
} from "./types";
import {
  calculateReadingTime,
  slugifyTitle,
  writeArticle,
} from "./write-content";

export interface ImportOptions extends HttpOptions {
  transform?: ArticleTransform;
  publicDir?: string;
  contentDir?: string;
  reportPath?: string;
  expectedCount?: number;
  dryRun?: boolean;
}

export interface ImportArgs {
  startUrl: string;
  rootDir: string;
  expectedCount?: number;
  contentDir: string;
  publicDir: string;
  reportPath: string;
  dryRun: boolean;
  maxRetries: number;
}

export interface ImportResult {
  report: MigrationReport;
  reportPath: string;
  writtenPaths: string[];
  exitCode: 0 | 1 | 2;
}

export function parseCliArgs(argv: readonly string[]): ImportArgs {
  const rootDir = process.cwd();
  let startUrl = "";
  let expectedCount: number | undefined;
  let contentDir = path.join(rootDir, "src", "content", "articles");
  let publicDir = path.join(rootDir, "public");
  let reportPath = path.join(rootDir, "outputs", "import-report.json");
  let dryRun = false;
  let maxRetries = 2;

  const readValue = (index: number, option: string): string => {
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${option}`);
    }
    return value;
  };
  const positiveInteger = (value: string, option: string): number => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error(`${option} must be a positive integer`);
    }
    return parsed;
  };
  const nonNegativeInteger = (value: string, option: string): number => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new Error(`${option} must be a non-negative integer`);
    }
    return parsed;
  };

  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index]!;
    switch (option) {
      case "--url":
        startUrl = readValue(index, option);
        index += 1;
        break;
      case "--expected-count":
        expectedCount = positiveInteger(readValue(index, option), option);
        index += 1;
        break;
      case "--content-dir":
        contentDir = readValue(index, option);
        index += 1;
        break;
      case "--public-dir":
        publicDir = readValue(index, option);
        index += 1;
        break;
      case "--report":
        reportPath = readValue(index, option);
        index += 1;
        break;
      case "--dry-run":
        dryRun = true;
        break;
      case "--max-retries":
        maxRetries = nonNegativeInteger(readValue(index, option), option);
        index += 1;
        break;
      default:
        throw new Error(`Unknown option: ${option}`);
    }
  }

  if (!startUrl) {
    throw new Error(
      "Usage: cli.ts --url <public-blog-url> [--expected-count <count>] [--dry-run]",
    );
  }
  return {
    startUrl,
    rootDir,
    expectedCount,
    contentDir,
    publicDir,
    reportPath,
    dryRun,
    maxRetries,
  };
}

export function resolveExitCode(report: MigrationReport): 0 | 1 | 2 {
  if (report.failures.length > 0) {
    return 1;
  }
  return report.assets.some((asset) => asset.status === "failed") ? 2 : 0;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function importCsdnArticles(
  startUrl: string,
  rootDir: string,
  options: ImportOptions,
): Promise<ImportResult> {
  const startedAt = new Date().toISOString();

  const failures: MigrationReport["failures"] = [];
  const assets: MigrationReport["assets"] = [];
  const writtenPaths: string[] = [];
  let discovered: ArticleIndexItem[] = [];

  try {
    discovered = await discoverArticleIndex(startUrl, options);
  } catch (error) {
    failures.push({
      sourceId: "",
      url: startUrl,
      stage: "discover",
      message: errorMessage(error),
    });
  }

  if (
    failures.length === 0 &&
    options.expectedCount !== undefined &&
    discovered.length !== options.expectedCount
  ) {
    failures.push({
      sourceId: "",
      url: startUrl,
      stage: "discover",
      message: `Article count mismatch: expected ${options.expectedCount}, found ${discovered.length}`,
    });
  }

  let written = 0;

  const shouldWrite = failures.length === 0 && !options.dryRun;
  for (const item of shouldWrite ? discovered : []) {
    let raw: RawArticle | null = null;
    try {
      raw = await fetchArticle(item.url, options);
    } catch (error) {
      failures.push({
        sourceId: item.sourceId,
        url: item.url,
        stage: "fetch",
        message: errorMessage(error),
      });
      continue;
    }

    let document: ArticleDocument;
    try {
      if (options.transform) {
        const markdown = await options.transform(raw, item);
        const title = raw.title || item.title || `文章 ${item.sourceId}`;
        document = {
          sourceId: item.sourceId,
          title,
          slug: "",
          category: raw.category || item.category || "技术",
          publishedAt:
            raw.publishedAt || item.publishedAt || startedAt.slice(0, 10),
          ...(raw.updatedAt ? { updatedAt: raw.updatedAt } : {}),
          summary: raw.summary || item.summary || title,
          readingTime: calculateReadingTime(markdown),
          markdown,
          assets: [],
        };
      } else {
        const sanitized = sanitizeArticleHtml(raw.html, raw.url);
        document = {
          sourceId: item.sourceId,
          title: sanitized.title,
          slug: "",
          category: sanitized.category,
          publishedAt: sanitized.publishedAt,
          ...(sanitized.updatedAt ? { updatedAt: sanitized.updatedAt } : {}),
          summary: sanitized.summary,
          readingTime: calculateReadingTime(sanitized.markdown),
          markdown: sanitized.markdown,
          assets: [],
        };
      }
    } catch (error) {
      failures.push({
        sourceId: item.sourceId,
        url: item.url,
        stage: options.transform ? "write" : "sanitize",
        message: errorMessage(error),
      });
      continue;
    }

    try {
      const downloaded = await downloadArticleAssets(
        document.markdown,
        slugifyTitle(document.title),
        options.publicDir ?? path.join(rootDir, "public"),
        options,
      );
      document.markdown = downloaded.markdown;
      document.assets = downloaded.assets;
      document.readingTime = calculateReadingTime(downloaded.markdown);
      assets.push(
        ...downloaded.assets.map((asset) => ({
          sourceUrl: asset.sourceUrl,
          ...(asset.localPath ? { localPath: asset.localPath } : {}),
          status: asset.status,
          ...(asset.error ? { message: asset.error } : {}),
        })),
      );
      const writtenPath = await writeArticle(
        document,
        rootDir,
        options.contentDir,
      );
      writtenPaths.push(writtenPath);
      written += 1;
    } catch (error) {
      failures.push({
        sourceId: item.sourceId,
        url: item.url,
        stage: "write",
        message: errorMessage(error),
      });
    }
  }

  const report: MigrationReport = {
    startedAt,
    finishedAt: new Date().toISOString(),
    discovered: discovered.length,
    discoveredArticles: discovered,
    written,
    skipped: Math.max(0, discovered.length - written),
    failures,
    assets,
  };
  const reportPath = await writeMigrationReport(
    report,
    rootDir,
    options.reportPath,
  );

  return {
    report,
    reportPath,
    writtenPaths,
    exitCode: resolveExitCode(report),
  };
}

export async function runImport(
  args: ImportArgs,
  options: ImportOptions,
): Promise<ImportResult> {
  const rootDir = path.resolve(args.rootDir);
  return importCsdnArticles(args.startUrl, rootDir, {
    ...options,
    expectedCount: args.expectedCount,
    contentDir: path.resolve(rootDir, args.contentDir),
    publicDir: path.resolve(rootDir, args.publicDir),
    reportPath: path.resolve(rootDir, args.reportPath),
    dryRun: args.dryRun,
    retries: args.maxRetries,
  });
}

async function main(): Promise<number> {
  const args = parseCliArgs(process.argv.slice(2));
  const result = await runImport(args, {});
  process.stdout.write(
    `Discovered ${result.report.discovered}, written ${result.report.written}, failures ${result.report.failures.length}, report ${result.reportPath}\n`,
  );
  return result.exitCode;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const modulePath = fileURLToPath(import.meta.url);

if (invokedPath === modulePath) {
  main()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error: unknown) => {
      process.stderr.write(`${errorMessage(error)}\n`);
      process.exitCode = 1;
    });
}
