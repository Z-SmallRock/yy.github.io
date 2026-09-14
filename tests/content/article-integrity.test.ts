import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { describe, expect, test } from "vitest";

const contentDir = path.resolve("src/content/articles");

function assertNonEmptyText(
  value: unknown,
  fieldName: string,
  filePath: string,
): void {
  expect(
    typeof value === "string" && value.trim().length > 0,
    `${filePath}：frontmatter.${fieldName} 必须是非空字符串`,
  ).toBe(true);
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function listArticleFiles(): Promise<string[]> {
  try {
    const entries = await readdir(contentDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && /\.(md|mdx)$/i.test(entry.name))
      .map((entry) => path.join(contentDir, entry.name))
      .sort();
  } catch (error) {
    // 初始骨架阶段还没有文章目录，视为空集合而不是失败。
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

describe("文章内容完整性", () => {
  test("站点精确包含 19 篇文章", async () => {
    const files = await listArticleFiles();
    expect(files).toHaveLength(19);
  });

  test("每篇文章的元数据、正文与文件名均满足发布约束", async () => {
    const files = await listArticleFiles();
    const slugs: string[] = [];
    const sourceIds: string[] = [];

    for (const file of files) {
      const fileLabel = path
        .relative(process.cwd(), file)
        .split(path.sep)
        .join("/");
      const source = await readFile(file, "utf8");
      const parsed = matter(source);
      const data = parsed.data;

      assertNonEmptyText(data.title, "title", fileLabel);
      assertNonEmptyText(data.slug, "slug", fileLabel);
      assertNonEmptyText(data.category, "category", fileLabel);
      assertNonEmptyText(data.summary, "summary", fileLabel);
      assertNonEmptyText(data.sourceId, "sourceId", fileLabel);

      const published = parseDate(data.publishedAt);
      expect(
        published !== null,
        `${fileLabel}：publishedAt 必须是有效日期`,
      ).toBe(true);

      if (data.updatedAt !== undefined) {
        const updated = parseDate(data.updatedAt);
        expect(
          updated !== null,
          `${fileLabel}：updatedAt 存在时必须是有效日期`,
        ).toBe(true);
      }

      const readingTime = data.readingTime;
      expect(
        typeof readingTime === "number" &&
          Number.isInteger(readingTime) &&
          readingTime > 0,
        `${fileLabel}：readingTime 必须是正整数`,
      ).toBe(true);

      expect(
        parsed.content.trim().length > 0,
        `${fileLabel}：文章正文不能为空`,
      ).toBe(true);

      const slug = String(data.slug).trim();
      const sourceId = String(data.sourceId).trim();

      expect(
        path.basename(file) === `${slug}.md`,
        `${fileLabel}：导入文章文件名必须与 frontmatter.slug 一致`,
      ).toBe(true);

      slugs.push(slug);
      sourceIds.push(sourceId);
    }

    expect(new Set(sourceIds).size).toBe(19);
    expect(new Set(slugs).size).toBe(19);
  });
});
