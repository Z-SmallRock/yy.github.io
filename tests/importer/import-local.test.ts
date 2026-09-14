import {
  access,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import matter from "gray-matter";
import { afterEach, describe, expect, test } from "vitest";
import {
  importLocalArticles,
  parseLocalCliArgs,
} from "../../scripts/import-csdn/import-local";
import type { LocalArticleMetadata } from "../../scripts/import-csdn/local-articles";
import type { FetchLike } from "../../scripts/import-csdn/types";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) =>
      rm(root, { recursive: true, force: true }),
    ),
  );
});

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "local-articles-"));
  temporaryRoots.push(root);
  return root;
}

function article(
  overrides: Partial<LocalArticleMetadata> = {},
): LocalArticleMetadata {
  return {
    filename: "测试文章.md",
    title: "测试文章",
    slug: "测试文章",
    category: "测试",
    publishedAt: "2020-01-02",
    summary: "用于验证本地导入流程。",
    sourceId: "1001",
    ...overrides,
  };
}

function imageResponse(): Response {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  return new Response(png, {
    status: 200,
    headers: {
      "content-type": "image/png",
      "content-length": String(png.byteLength),
    },
  });
}

describe("parseLocalCliArgs", () => {
  test("提供本地目录默认值并解析显式参数", () => {
    expect(parseLocalCliArgs([])).toMatchObject({
      sourceDir: "C:\\ShawnL_Wiki\\csdn",
      rootDir: process.cwd(),
      dryRun: false,
      maxRetries: 2,
    });
    expect(
      parseLocalCliArgs([
        "--source-dir",
        "D:\\articles",
        "--report",
        "reports\\local.json",
        "--max-retries",
        "0",
        "--dry-run",
      ]),
    ).toMatchObject({
      sourceDir: "D:\\articles",
      reportPath: "reports\\local.json",
      maxRetries: 0,
      dryRun: true,
    });
  });
});

describe("importLocalArticles", () => {
  test("清洗本地正文、下载图片并保持源文件内容不变", async () => {
    const root = await makeRoot();
    const sourceDir = path.join(root, "source");
    const siteDir = path.join(root, "site");
    await mkdir(sourceDir, { recursive: true });
    const imageUrl =
      "https://i-blog.csdnimg.cn/blog_migrate/local-test.png";
    const raw = [
      "编辑",
      "[原文](https://blog.csdn.net/qq_27395289/article/details/1001)",
      `![图](${imageUrl})`,
      "正文",
    ].join("\n\n");
    await writeFile(path.join(sourceDir, "测试文章.md"), raw, "utf8");
    const fetchImpl: FetchLike = async () => imageResponse();

    const result = await importLocalArticles([article()], {
      sourceDir,
      rootDir: siteDir,
      fetch: fetchImpl,
      retries: 0,
      timeoutMs: 1000,
    });

    expect(result.exitCode).toBe(0);
    expect(result.report).toMatchObject({
      discovered: 1,
      written: 1,
      skipped: 0,
      failures: [],
      sourceDirectory: sourceDir,
    });
    expect(result.report.removedCsdnReferences).toBeGreaterThanOrEqual(2);
    expect(await readFile(path.join(sourceDir, "测试文章.md"), "utf8")).toBe(
      raw,
    );

    const written = await readFile(
      path.join(siteDir, "src", "content", "articles", "测试文章.md"),
      "utf8",
    );
    const parsed = matter(written);
    expect(parsed.data).toMatchObject({
      title: "测试文章",
      slug: "测试文章",
      publishedAt: "2020-01-02",
      sourceId: "1001",
    });
    expect(parsed.content).toContain("正文");
    expect(parsed.content).not.toMatch(/csdn\.net|csdnimg\.cn|^编辑$/imu);
    expect(parsed.content).toMatch(
      /!\[图\]\(\/images\/articles\/测试文章\/[a-f0-9]+\.webp\)/,
    );
    await expect(
      access(path.join(siteDir, "outputs", "local-import-report.json")),
    ).resolves.toBeUndefined();
  });

  test("单篇源文件缺失时继续导入其他文章并记录失败", async () => {
    const root = await makeRoot();
    const sourceDir = path.join(root, "source");
    const siteDir = path.join(root, "site");
    await mkdir(sourceDir, { recursive: true });
    await writeFile(path.join(sourceDir, "测试文章.md"), "正文", "utf8");

    const result = await importLocalArticles(
      [
        article(),
        article({
          filename: "缺失.md",
          title: "缺失文章",
          slug: "缺失文章",
          sourceId: "1002",
        }),
      ],
      { sourceDir, rootDir: siteDir, retries: 0 },
    );

    expect(result.exitCode).toBe(1);
    expect(result.report.written).toBe(1);
    expect(result.report.skipped).toBe(1);
    expect(result.report.failures).toEqual([
      expect.objectContaining({
        sourceId: "1002",
        sourceFile: path.join(sourceDir, "缺失.md"),
        stage: "read",
      }),
    ]);
  });

  test("拒绝覆盖同 slug 的无关文章", async () => {
    const root = await makeRoot();
    const sourceDir = path.join(root, "source");
    const siteDir = path.join(root, "site");
    const contentDir = path.join(siteDir, "src", "content", "articles");
    await mkdir(sourceDir, { recursive: true });
    await mkdir(contentDir, { recursive: true });
    await writeFile(path.join(sourceDir, "测试文章.md"), "新正文", "utf8");
    await writeFile(
      path.join(contentDir, "测试文章.md"),
      "---\ntitle: 原文章\nslug: 测试文章\nsourceId: other\n---\n\n旧正文\n",
      "utf8",
    );

    const result = await importLocalArticles([article()], {
      sourceDir,
      rootDir: siteDir,
      retries: 0,
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.written).toBe(0);
    expect(result.report.failures[0]).toMatchObject({ stage: "write" });
    expect(await readFile(path.join(contentDir, "测试文章.md"), "utf8")).toContain(
      "旧正文",
    );
  });
});
