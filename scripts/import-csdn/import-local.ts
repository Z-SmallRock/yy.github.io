import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { resolveExitCode } from "./cli";
import { downloadArticleAssets } from "./download-assets";
import {
  localArticles,
  validateLocalArticleManifest,
  type LocalArticleMetadata,
} from "./local-articles";
import { writeMigrationReport } from "./report";
import { sanitizeLocalMarkdown } from "./sanitize-markdown";
import type {
  ArticleDocument,
  AssetDownloadOptions,
  MigrationReport,
} from "./types";
import { calculateReadingTime, writeArticle } from "./write-content";

const DEFAULT_SOURCE_DIR = "C:\\ShawnL_Wiki\\csdn";
const RESIDUE_RE =
  /csdn\.net|csdnimg\.cn|\bCSDN\b|data:image\/gif|点击并拖拽以移动|^\s*编辑\s*$/gimu;

export interface LocalImportOptions extends AssetDownloadOptions {
  sourceDir: string;
  rootDir: string;
  contentDir?: string;
  publicDir?: string;
  reportPath?: string;
  dryRun?: boolean;
}

export interface LocalImportArgs {
  sourceDir: string;
  rootDir: string;
  contentDir: string;
  publicDir: string;
  reportPath: string;
  dryRun: boolean;
  maxRetries: number;
}

export interface LocalImportResult {
  report: MigrationReport;
  reportPath: string;
  writtenPaths: string[];
  exitCode: 0 | 1 | 2;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function countResidue(markdown: string): number {
  return [...markdown.matchAll(RESIDUE_RE)].length;
}

function resolveFromRoot(rootDir: string, value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(rootDir, value);
}

async function assertTargetOwnership(
  contentDir: string,
  entry: LocalArticleMetadata,
): Promise<void> {
  const target = path.join(contentDir, `${entry.slug}.md`);
  try {
    const parsed = matter(await readFile(target, "utf8"));
    const sourceId = String(parsed.data.sourceId ?? "").trim();
    if (sourceId !== entry.sourceId) {
      throw new Error(
        `Refusing to overwrite "${entry.slug}" owned by source "${sourceId || "unknown"}"`,
      );
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }
    throw error;
  }
}

async function unlistedSourceFiles(
  entries: readonly LocalArticleMetadata[],
  sourceDir: string,
): Promise<string[]> {
  try {
    const expected = new Set(entries.map((entry) => entry.filename));
    const sourceEntries = await readdir(sourceDir, { withFileTypes: true });
    return sourceEntries
      .filter(
        (entry) =>
          entry.isFile() &&
          path.extname(entry.name).toLowerCase() === ".md" &&
          !expected.has(entry.name),
      )
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

export async function importLocalArticles(
  entries: readonly LocalArticleMetadata[],
  options: LocalImportOptions,
): Promise<LocalImportResult> {
  const startedAt = new Date().toISOString();
  const rootDir = path.resolve(options.rootDir);
  const sourceDir = path.resolve(options.sourceDir);
  const contentDir = options.contentDir
    ? resolveFromRoot(rootDir, options.contentDir)
    : path.join(rootDir, "src", "content", "articles");
  const publicDir = options.publicDir
    ? resolveFromRoot(rootDir, options.publicDir)
    : path.join(rootDir, "public");
  const reportTarget = options.reportPath
    ? resolveFromRoot(rootDir, options.reportPath)
    : path.join(rootDir, "outputs", "local-import-report.json");
  const failures: MigrationReport["failures"] = [];
  const assets: MigrationReport["assets"] = [];
  const writtenPaths: string[] = [];
  let removedCsdnReferences = 0;

  const manifestErrors = validateLocalArticleManifest(entries);
  for (const message of manifestErrors) {
    failures.push({
      sourceId: "",
      url: "",
      stage: "manifest",
      message,
    });
  }

  for (const filename of await unlistedSourceFiles(entries, sourceDir)) {
    failures.push({
      sourceId: "",
      url: "",
      sourceFile: path.join(sourceDir, filename),
      stage: "discover",
      message: `Source Markdown is not present in the manifest: ${filename}`,
    });
  }

  if (manifestErrors.length === 0 && !options.dryRun) {
    for (const entry of entries) {
      const sourceFile = path.join(sourceDir, entry.filename);
      let raw: string;
      try {
        raw = await readFile(sourceFile, "utf8");
      } catch (error) {
        failures.push({
          sourceId: entry.sourceId,
          url: "",
          sourceFile,
          stage: "read",
          message: errorMessage(error),
        });
        continue;
      }

      try {
        const cleaned = sanitizeLocalMarkdown(raw, entry.title);
        const localized = await downloadArticleAssets(
          cleaned,
          entry.slug,
          publicDir,
          options,
        );
        removedCsdnReferences += Math.max(
          0,
          countResidue(raw) - countResidue(localized.markdown),
        );
        assets.push(
          ...localized.assets.map((asset) => ({
            sourceUrl: asset.sourceUrl,
            ...(asset.localPath ? { localPath: asset.localPath } : {}),
            status: asset.status,
            ...(asset.error ? { message: asset.error } : {}),
          })),
        );

        const document: ArticleDocument = {
          ...entry,
          readingTime: calculateReadingTime(localized.markdown),
          markdown: localized.markdown,
          assets: localized.assets,
        };
        await assertTargetOwnership(contentDir, entry);
        const writtenPath = await writeArticle(
          document,
          rootDir,
          contentDir,
        );
        writtenPaths.push(writtenPath);
      } catch (error) {
        failures.push({
          sourceId: entry.sourceId,
          url: "",
          sourceFile,
          stage: "write",
          message: errorMessage(error),
        });
      }
    }
  }

  const report: MigrationReport = {
    startedAt,
    finishedAt: new Date().toISOString(),
    discovered: entries.length,
    sourceDirectory: sourceDir,
    removedCsdnReferences,
    written: writtenPaths.length,
    skipped: Math.max(0, entries.length - writtenPaths.length),
    failures,
    assets,
  };
  const reportPath = await writeMigrationReport(
    report,
    rootDir,
    reportTarget,
  );

  return {
    report,
    reportPath,
    writtenPaths,
    exitCode: resolveExitCode(report),
  };
}

export function parseLocalCliArgs(
  argv: readonly string[],
): LocalImportArgs {
  const rootDir = process.cwd();
  let sourceDir = DEFAULT_SOURCE_DIR;
  let contentDir = path.join(rootDir, "src", "content", "articles");
  let publicDir = path.join(rootDir, "public");
  let reportPath = path.join(rootDir, "outputs", "local-import-report.json");
  let dryRun = false;
  let maxRetries = 2;

  const readValue = (index: number, option: string): string => {
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${option}`);
    }
    return value;
  };

  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index]!;
    switch (option) {
      case "--source-dir":
        sourceDir = readValue(index, option);
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
      case "--max-retries": {
        const value = Number(readValue(index, option));
        if (!Number.isInteger(value) || value < 0) {
          throw new Error("--max-retries must be a non-negative integer");
        }
        maxRetries = value;
        index += 1;
        break;
      }
      case "--dry-run":
        dryRun = true;
        break;
      default:
        throw new Error(`Unknown option: ${option}`);
    }
  }

  return {
    sourceDir,
    rootDir,
    contentDir,
    publicDir,
    reportPath,
    dryRun,
    maxRetries,
  };
}

async function main(): Promise<number> {
  const args = parseLocalCliArgs(process.argv.slice(2));
  const result = await importLocalArticles(localArticles, {
    sourceDir: args.sourceDir,
    rootDir: args.rootDir,
    contentDir: args.contentDir,
    publicDir: args.publicDir,
    reportPath: args.reportPath,
    dryRun: args.dryRun,
    retries: args.maxRetries,
  });
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
