import { readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  localArticles,
  validateLocalArticleManifest,
} from "../../scripts/import-csdn/local-articles";

const sourceDir = "C:\\ShawnL_Wiki\\csdn";

describe("localArticles", () => {
  test("包含 18 个唯一且完整的文章记录", () => {
    expect(localArticles).toHaveLength(18);
    expect(new Set(localArticles.map((item) => item.filename)).size).toBe(18);
    expect(new Set(localArticles.map((item) => item.slug)).size).toBe(18);
    expect(new Set(localArticles.map((item) => item.sourceId)).size).toBe(18);
    expect(validateLocalArticleManifest(localArticles)).toEqual([]);
  });

  test("元数据清单与本地 Markdown 文件一一对应", async () => {
    const entries = await readdir(sourceDir, { withFileTypes: true });
    const sourceFiles = entries
      .filter((entry) => entry.isFile() && path.extname(entry.name) === ".md")
      .map((entry) => entry.name)
      .sort();
    const manifestFiles = localArticles
      .map((article) => article.filename)
      .sort();

    expect(manifestFiles).toEqual(sourceFiles);
  });

  test("未命名文章使用正文对应的正式标题和原始文章信息", () => {
    const article = localArticles.find(
      (item) => item.filename === "未命名.md",
    );

    expect(article).toMatchObject({
      title:
        "Electron preload 加载 Sentry 时出现 Unexpected token import",
      publishedAt: "2020-10-19",
      sourceId: "109156740",
    });
  });

  test("验证器报告重复项、空字段、错误日期和非法 slug", () => {
    const base = localArticles[0]!;
    const errors = validateLocalArticleManifest([
      base,
      {
        ...base,
        title: "",
        publishedAt: "not-a-date",
        slug: "../escape",
      },
    ]);

    expect(errors.join("\n")).toMatch(/duplicate filename/i);
    expect(errors.join("\n")).toMatch(/duplicate sourceId/i);
    expect(errors.join("\n")).toMatch(/title/i);
    expect(errors.join("\n")).toMatch(/publishedAt/i);
    expect(errors.join("\n")).toMatch(/slug/i);
  });
});
