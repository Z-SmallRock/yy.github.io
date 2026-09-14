import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  importCsdnArticles,
  parseCliArgs,
  resolveExitCode,
} from "../../scripts/import-csdn/cli";
import type {
  FetchLike,
  MigrationReport,
} from "../../scripts/import-csdn/types";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) =>
      rm(root, { recursive: true, force: true }),
    ),
  );
});

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "csdn-cli-"));
  temporaryRoots.push(root);
  return root;
}

function makeFetcher(routes: Record<string, string>) {
  const fetchImpl: FetchLike = async (input) => {
    const url = String(input);
    const html = routes[url];
    if (html === undefined) {
      return new Response("not found", { status: 404 });
    }
    return new Response(html, {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  };

  return fetchImpl;
}

async function readReport(root: string): Promise<MigrationReport> {
  const source = await readFile(
    path.join(root, "outputs", "import-report.json"),
    "utf8",
  );
  return JSON.parse(source) as MigrationReport;
}

const listOne = "https://blog.csdn.net/shiliu/article/list/1";
const articleOne = "https://blog.csdn.net/article/details/101";

describe("parseCliArgs", () => {
  test("解析命名参数并为目录与重试次数提供默认值", () => {
    expect(
      parseCliArgs([
        "--url",
        "/list",
        "--expected-count",
        "57",
        "--content-dir",
        "/content",
        "--public-dir",
        "/public",
        "--report",
        "/reports/import.json",
        "--dry-run",
        "--max-retries",
        "4",
      ]),
    ).toEqual({
      startUrl: "/list",
      rootDir: process.cwd(),
      expectedCount: 57,
      contentDir: "/content",
      publicDir: "/public",
      reportPath: "/reports/import.json",
      dryRun: true,
      maxRetries: 4,
    });

    expect(parseCliArgs(["--url", "/list"])).toEqual({
      startUrl: "/list",
      rootDir: process.cwd(),
      expectedCount: undefined,
      contentDir: path.join(process.cwd(), "src", "content", "articles"),
      publicDir: path.join(process.cwd(), "public"),
      reportPath: path.join(process.cwd(), "outputs", "import-report.json"),
      dryRun: false,
      maxRetries: 2,
    });
  });

  test("拒绝缺失值、未知参数和非法数字", () => {
    expect(() => parseCliArgs([])).toThrow(/--url/);
    expect(() => parseCliArgs(["--url"])).toThrow(/--url/);
    expect(() => parseCliArgs(["--url", "/list", "--unknown"])).toThrow(
      /Unknown option/,
    );
    expect(() =>
      parseCliArgs(["--url", "/list", "--expected-count", "0"]),
    ).toThrow(/expected-count/);
    expect(() =>
      parseCliArgs(["--url", "/list", "--max-retries", "-1"]),
    ).toThrow(/max-retries/);
  });
});

describe("resolveExitCode", () => {
  test("文章失败返回 1，只有资源失败返回 2，否则返回 0", () => {
    expect(
      resolveExitCode({
        failures: [
          {
            sourceId: "101",
            url: articleOne,
            stage: "fetch",
            message: "boom",
          },
        ],
      } as MigrationReport),
    ).toBe(1);
    expect(
      resolveExitCode({
        failures: [],
        assets: [
          {
            sourceUrl: "https://example.com/missing.png",
            status: "failed",
            message: "HTTP 404",
          },
        ],
      } as unknown as MigrationReport),
    ).toBe(2);
    expect(
      resolveExitCode({ failures: [], assets: [] } as unknown as MigrationReport),
    ).toBe(0);
  });
});

describe("importCsdnArticles", () => {
  test("dry-run 只发现索引并写报告，不抓取正文或写文章", async () => {
    const root = await makeRoot();
    const contentDir = path.join(root, "custom-content");
    const reportPath = path.join(root, "reports", "dry-run.json");
    const calls: string[] = [];
    const fetchImpl: FetchLike = async (input) => {
      const url = String(input);
      calls.push(url);
      if (url === listOne) {
        return new Response(`<a href="/article/details/101">目录标题</a>`, {
          status: 200,
        });
      }
      return new Response("unexpected article fetch", { status: 500 });
    };

    const result = await importCsdnArticles(listOne, root, {
      fetch: fetchImpl,
      retries: 0,
      timeoutMs: 1000,
      expectedCount: 1,
      dryRun: true,
      contentDir,
      reportPath,
    });

    expect(result.exitCode).toBe(0);
    expect(result.report.discovered).toBe(1);
    expect(result.report.written).toBe(0);
    expect(result.report.skipped).toBe(1);
    expect(result.report.discoveredArticles).toHaveLength(1);
    expect(calls).toEqual([listOne]);
    await expect(access(contentDir)).rejects.toMatchObject({ code: "ENOENT" });
    expect(JSON.parse(await readFile(reportPath, "utf8"))).toEqual(result.report);
  });

  test("发现数量与 expected-count 不符时立即失败且不抓取正文", async () => {
    const root = await makeRoot();
    const calls: string[] = [];
    const fetchImpl: FetchLike = async (input) => {
      calls.push(String(input));
      return new Response(`<a href="/article/details/101">目录标题</a>`, {
        status: 200,
      });
    };

    const result = await importCsdnArticles(listOne, root, {
      fetch: fetchImpl,
      retries: 0,
      timeoutMs: 1000,
      expectedCount: 57,
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.written).toBe(0);
    expect(result.report.failures[0]).toMatchObject({
      stage: "discover",
    });
    expect(result.report.failures[0]?.message).toMatch(/expected 57.*found 1/i);
    expect(calls).toEqual([listOne]);
  });

  test("将文章、图片和报告写入显式指定的目录", async () => {
    const root = await makeRoot();
    const contentDir = path.join(root, "content-target");
    const publicDir = path.join(root, "public-target");
    const reportPath = path.join(root, "report-target", "result.json");
    const fetchImpl = makeFetcher({
      [listOne]: `<a href="/article/details/101">目录标题</a>`,
      [articleOne]: `
        <h1 class="title-article">真实标题</h1>
        <div id="content_views"><p>正文保留</p></div>
      `,
    });

    const result = await importCsdnArticles(listOne, root, {
      fetch: fetchImpl,
      retries: 0,
      timeoutMs: 1000,
      contentDir,
      publicDir,
      reportPath,
    });

    expect(result.exitCode).toBe(0);
    expect(result.writtenPaths).toEqual([
      path.join(contentDir, "真实标题.md"),
    ]);
    expect(await readFile(result.writtenPaths[0]!, "utf8")).toContain("正文保留");
    expect(JSON.parse(await readFile(reportPath, "utf8"))).toEqual(result.report);
  });

  test("通过 transform 写入转换后的 Markdown，不写入 raw HTML，exitCode=0", async () => {
    const root = await makeRoot();
    const fetchImpl = makeFetcher({
      [listOne]: `<a href="/article/details/101">目录标题</a>`,
      [articleOne]: `<html><head><title>真实标题</title></head><body><h1>真实标题</h1><script>alert(1)</script></body></html>`,
    });

    const result = await importCsdnArticles(listOne, root, {
      fetch: fetchImpl,
      retries: 0,
      timeoutMs: 1000,
      transform: async (raw) => `# ${raw.title}\n\n安全正文\n`,
    });

    expect(result.exitCode).toBe(0);
    expect(result.report.written).toBe(1);
    expect(result.report.failures).toEqual([]);

    const article = await readFile(
      path.join(root, "src", "content", "articles", "真实标题.md"),
      "utf8",
    );
    expect(article).toContain("安全正文");
    expect(article).not.toContain("<script>");
    expect(await readReport(root)).toEqual(result.report);
  });

  test("缺少自定义 transform 时使用安全清洗器，不会写入无正文容器的 raw HTML", async () => {
    const root = await makeRoot();
    const fetchImpl = makeFetcher({
      [listOne]: `<a href="/article/details/101">目录标题</a>`,
      [articleOne]: `<html><body>raw</body></html>`,
    });

    const result = await importCsdnArticles(listOne, root, {
      fetch: fetchImpl,
      retries: 0,
      timeoutMs: 1000,
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.failures[0]?.stage).toBe("sanitize");
    expect(result.report.written).toBe(0);
  });

  test("默认流水线清洗正文、下载图片并将资源写入报告", async () => {
    const root = await makeRoot();
    const imageUrl = "https://i-blog.csdnimg.cn/blog_migrate/test.png";
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    );
    const fetchImpl: FetchLike = async (input) => {
      const url = String(input);
      if (url === listOne) {
        return new Response(`<a href="/article/details/101">目录标题</a>`, { status: 200 });
      }
      if (url === articleOne) {
        return new Response(`
          <html><head>
            <meta property="article:published_time" content="2024-04-01T10:00:00+08:00">
            <meta name="description" content="摘要">
          </head><body>
            <h1 class="title-article">真实标题</h1>
            <div class="blog-tags-box"><a>工程</a></div>
            <div id="content_views"><p>安全正文</p><img src="${imageUrl}" alt="图"></div>
          </body></html>`, { status: 200 });
      }
      if (url === imageUrl) {
        return new Response(png, {
          status: 200,
          headers: { "content-type": "image/png", "content-length": String(png.byteLength) },
        });
      }
      return new Response("not found", { status: 404 });
    };

    const result = await importCsdnArticles(listOne, root, {
      fetch: fetchImpl,
      retries: 0,
      timeoutMs: 1000,
    });

    expect(result.exitCode).toBe(0);
    expect(result.report.assets).toEqual([
      expect.objectContaining({ sourceUrl: imageUrl, status: "downloaded" }),
    ]);
    const article = await readFile(
      path.join(root, "src", "content", "articles", "真实标题.md"),
      "utf8",
    );
    expect(article).toContain("# 真实标题");
    expect(article).toMatch(/\/images\/articles\/真实标题\/[a-f0-9]+\.webp/);
    expect(article).not.toContain("<div");
  });

  test("只有图片失败时仍写入文章并返回警告状态 2", async () => {
    const root = await makeRoot();
    const imageUrl = "https://example.com/missing.png";
    const fetchImpl: FetchLike = async (input) => {
      const url = String(input);
      if (url === listOne) {
        return new Response(`<a href="/article/details/101">目录标题</a>`, { status: 200 });
      }
      if (url === articleOne) {
        return new Response(`
          <h1 class="title-article">真实标题</h1>
          <div id="content_views"><p>正文保留</p><img src="${imageUrl}" alt="失败图"></div>
        `, { status: 200 });
      }
      return new Response("missing", { status: 404 });
    };

    const result = await importCsdnArticles(listOne, root, {
      fetch: fetchImpl,
      retries: 0,
      timeoutMs: 1000,
    });

    expect(result.exitCode).toBe(2);
    expect(result.report.written).toBe(1);
    expect(result.report.failures).toEqual([]);
    expect(result.report.assets[0]).toMatchObject({
      sourceUrl: imageUrl,
      status: "failed",
    });
    const article = await readFile(
      path.join(root, "src", "content", "articles", "真实标题.md"),
      "utf8",
    );
    expect(article).not.toContain("失败图");
    expect(article).not.toContain(imageUrl);
  });

  test("fetch 失败写入 stage=fetch 的报告并 exitCode=1", async () => {
    const root = await makeRoot();
    const fetchImpl = makeFetcher({
      [listOne]: `<a href="/article/details/101">目录标题</a>`,
    });

    const result = await importCsdnArticles(listOne, root, {
      fetch: fetchImpl,
      retries: 0,
      timeoutMs: 1000,
      transform: async () => "安全正文\n",
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.written).toBe(0);
    expect(result.report.failures).toHaveLength(1);
    expect(result.report.failures[0]).toMatchObject({
      sourceId: "101",
      stage: "fetch",
    });
    expect(await readReport(root)).toEqual(result.report);
  });

  test("write/transform 失败写入 stage=write 的报告并 exitCode=1", async () => {
    const root = await makeRoot();
    const fetchImpl = makeFetcher({
      [listOne]: `<a href="/article/details/101">目录标题</a>`,
      [articleOne]: `<html><body><h1>真实标题</h1></body></html>`,
    });

    const result = await importCsdnArticles(listOne, root, {
      fetch: fetchImpl,
      retries: 0,
      timeoutMs: 1000,
      transform: async () => {
        throw new Error("conversion failed");
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.written).toBe(0);
    expect(result.report.failures).toHaveLength(1);
    expect(result.report.failures[0]).toMatchObject({
      sourceId: "101",
      stage: "write",
    });
    expect(await readReport(root)).toEqual(result.report);
  });

  test("discover 失败也写入 stage=discover 的报告并 exitCode=1", async () => {
    const root = await makeRoot();
    const fetchImpl = makeFetcher({});

    const result = await importCsdnArticles(listOne, root, {
      fetch: fetchImpl,
      retries: 0,
      timeoutMs: 1000,
      transform: async () => "安全正文\n",
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.discovered).toBe(0);
    expect(result.report.failures).toHaveLength(1);
    expect(result.report.failures[0]).toMatchObject({
      sourceId: "",
      stage: "discover",
    });
    expect(await readReport(root)).toEqual(result.report);
  });
});
