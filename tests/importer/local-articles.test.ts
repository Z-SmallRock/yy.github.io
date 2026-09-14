import path from "node:path";
import { access } from "node:fs/promises";
import { describe, expect, test } from "vitest";
import {
  localArticles,
  validateLocalArticleManifest,
} from "../../scripts/import-csdn/local-articles";

const contentDir = path.resolve("src/content/articles");

describe("localArticles", () => {
  test("包含 18 个唯一且完整的文章记录", () => {
    expect(localArticles).toHaveLength(18);
    expect(new Set(localArticles.map((item) => item.filename)).size).toBe(18);
    expect(new Set(localArticles.map((item) => item.slug)).size).toBe(18);
    expect(new Set(localArticles.map((item) => item.sourceId)).size).toBe(18);
    expect(validateLocalArticleManifest(localArticles)).toEqual([]);
  });

  test("清单中的每篇文章都已生成仓库内容文件", async () => {
    for (const article of localArticles) {
      await expect(
        access(path.join(contentDir, `${article.slug}.md`)),
      ).resolves.toBeUndefined();
    }
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
