import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

// 文章集合的元数据由 schema 强制约束，字段缺失会在构建阶段直接报错。
const articles = defineCollection({
  loader: glob({
    pattern: "**/*.{md,mdx}",
    base: "./src/content/articles",
  }),
  schema: z
    .object({
      title: z.string().trim().min(1),
      slug: z.string().trim().min(1),
      publishedAt: z.coerce.date(),
      updatedAt: z.coerce.date().optional(),
      category: z.string().trim().min(1),
      summary: z.string().trim().min(1),
      readingTime: z.coerce.number().int().positive(),
      sourceId: z.string().trim().min(1),
    })
    .strict(),
});

export const collections = { articles };
