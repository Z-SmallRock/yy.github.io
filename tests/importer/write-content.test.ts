import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import matter from "gray-matter";
import { afterEach, describe, expect, test } from "vitest";
import {
  calculateReadingTime,
  slugifyTitle,
  writeArticle,
} from "../../scripts/import-csdn/write-content";
import type { ArticleDocument } from "../../scripts/import-csdn/types";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) =>
      rm(root, { recursive: true, force: true }),
    ),
  );
});

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "csdn-writer-"));
  temporaryRoots.push(root);
  return root;
}

function makeDocument(overrides: Partial<ArticleDocument> = {}): ArticleDocument {
  return {
    sourceId: "101",
    title: "理解 Rust 所有权",
    slug: "",
    category: "Rust",
    publishedAt: "2024-03-11",
    summary: "从栈与堆的模型出发，梳理借用与生命周期。",
    readingTime: 4,
    markdown: [
      "# 理解 Rust 所有权",
      "",
      "```rust",
      "fn main() {",
      "    println!(\"hello\");",
      "}",
      "```",
      "",
      "![栈与堆](/images/stack-heap.png)",
      "",
    ].join("\n"),
    assets: [],
    ...overrides,
  };
}

async function readArticleFile(root: string, slug: string) {
  const filePath = path.join(root, "src", "content", "articles", `${slug}.md`);
  const source = await readFile(filePath, "utf8");
  return { filePath, parsed: matter(source) };
}

describe("slugifyTitle", () => {
  test("由标题生成确定性的中文友好 slug", () => {
    expect(slugifyTitle("理解 Rust 所有权")).toBe("理解-rust-所有权");
    expect(slugifyTitle("  C++ 工程的 CMake 分层实践  ")).toBe(
      "c-工程的-cmake-分层实践",
    );
  });
});

describe("calculateReadingTime", () => {
  test("根据中文字符与代码内容返回正整数", () => {
    expect(calculateReadingTime("")).toBe(1);
    expect(calculateReadingTime("汉".repeat(600))).toBe(2);
  });
});

describe("writeArticle", () => {
  test("写入精确 frontmatter，并保留代码围栏与图片路径", async () => {
    const root = await makeRoot();
    const document = makeDocument();

    const writtenPath = await writeArticle(document, root);
    const { filePath, parsed } = await readArticleFile(root, "理解-rust-所有权");

    expect(writtenPath).toBe(filePath);
    expect(parsed.data).toEqual({
      title: "理解 Rust 所有权",
      slug: "理解-rust-所有权",
      publishedAt: "2024-03-11",
      category: "Rust",
      summary: "从栈与堆的模型出发，梳理借用与生命周期。",
      readingTime: 4,
      sourceId: "101",
    });
    expect(parsed.content.trim()).toBe(document.markdown.trim());
    expect(parsed.content).toContain("```rust");
    expect(parsed.content).toContain("![栈与堆](/images/stack-heap.png)");
  });

  test("同一 sourceId 的增量导入允许覆盖，并返回同一路径", async () => {
    const root = await makeRoot();
    const first = makeDocument({ markdown: "第一版正文\n" });
    const second = makeDocument({ markdown: "第二版正文\n" });

    const firstPath = await writeArticle(first, root);
    const secondPath = await writeArticle(second, root);
    const { parsed } = await readArticleFile(root, "理解-rust-所有权");

    expect(secondPath).toBe(firstPath);
    expect(parsed.content).toContain("第二版正文");
  });

  test("slug 冲突时追加稳定 sourceId，而不是覆盖不同文章", async () => {
    const root = await makeRoot();
    const original = makeDocument({ title: "同名文章", sourceId: "111" });
    const newcomer = makeDocument({ title: "同名文章", sourceId: "222" });

    await writeArticle(original, root);
    const newcomerPath = await writeArticle(newcomer, root);
    const originalFile = await readArticleFile(root, "同名文章");
    const newcomerFile = await readArticleFile(root, "同名文章-222");

    expect(newcomerPath).toBe(newcomerFile.filePath);
    expect(originalFile.parsed.data.sourceId).toBe("111");
    expect(newcomerFile.parsed.data.sourceId).toBe("222");
  });

  test("冲突后缀也被不同文章占用时拒绝写入", async () => {
    const root = await makeRoot();
    const articlesDir = path.join(root, "src", "content", "articles");
    await import("node:fs/promises").then(({ mkdir }) =>
      mkdir(articlesDir, { recursive: true }),
    );
    await writeFile(
      path.join(articlesDir, "同名文章.md"),
      [
        "---",
        "title: 同名文章",
        "slug: 同名文章",
        "sourceId: 999",
        "---",
        "",
        "已占用正文",
        "",
      ].join("\n"),
    );
    await writeFile(
      path.join(articlesDir, "同名文章-222.md"),
      [
        "---",
        "title: 同名文章",
        "slug: 同名文章-222",
        "sourceId: 888",
        "---",
        "",
        "后缀也占用正文",
        "",
      ].join("\n"),
    );

    const newcomer = makeDocument({ title: "同名文章", sourceId: "222" });
    await expect(writeArticle(newcomer, root)).rejects.toThrow(
      /Refusing to overwrite/,
    );
  });

  test("允许安全的显式 slug，但拒绝路径逃逸", async () => {
    const root = await makeRoot();

    const writtenPath = await writeArticle(
      makeDocument({ slug: "stable-rust-ownership" }),
      root,
    );
    expect(writtenPath).toBe(
      path.join(
        root,
        "src",
        "content",
        "articles",
        "stable-rust-ownership.md",
      ),
    );
    await expect(
      writeArticle(makeDocument({ slug: "../escape" }), root),
    ).rejects.toThrow(/Invalid slug/);
    await expect(
      writeArticle(makeDocument({ slug: "invalid--slug" }), root),
    ).rejects.toThrow(/Invalid slug/);
  });

  test("同一 sourceId 改名后写入新文件并删除旧文件", async () => {
    const root = await makeRoot();
    const oldPath = await writeArticle(
      makeDocument({ title: "旧标题", slug: "旧标题" }),
      root,
    );
    const newPath = await writeArticle(
      makeDocument({ title: "新标题", slug: "new-stable-title" }),
      root,
    );

    await expect(readFile(oldPath, "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(newPath).toBe(
      path.join(
        root,
        "src",
        "content",
        "articles",
        "new-stable-title.md",
      ),
    );
    expect(await readFile(newPath, "utf8")).toContain("sourceId: '101'");
  });

  test("文件存在但缺少 sourceId 时拒绝覆盖", async () => {
    const root = await makeRoot();
    const articlesDir = path.join(root, "src", "content", "articles");
    await import("node:fs/promises").then(({ mkdir }) =>
      mkdir(articlesDir, { recursive: true }),
    );
    await writeFile(
      path.join(articlesDir, "同名文章.md"),
      [
        "---",
        "title: 同名文章",
        "slug: 同名文章",
        "---",
        "",
        "缺少 sourceId 的旧正文",
        "",
      ].join("\n"),
    );

    await expect(
      writeArticle(makeDocument({ title: "同名文章", sourceId: "222" }), root),
    ).rejects.toThrow(/no sourceId/i);
  });
});
