import { describe, expect, test } from "vitest";
import {
  collectCategories,
  filterAndSortArticles,
  getTocEntries,
  type ArticleItem,
} from "../../src/lib/articles";

const fixtures: ArticleItem[] = [
  {
    slug: "rust-ownership",
    title: "理解 Rust 所有权",
    summary: "从栈与堆的模型出发，梳理借用与生命周期的判断方法。",
    category: "Rust",
    publishedAt: "2024-03-11",
    readingTime: 12,
  },
  {
    slug: "cpp-cmake",
    title: "C++ 工程的 CMake 分层实践",
    summary: "用 target 指令替代全局污染，整理现代 CMake 目录结构。",
    category: "C++",
    publishedAt: "2023-08-02",
    readingTime: 9,
  },
  {
    slug: "qt-model-view",
    title: "Qt Model/View 与大型表格",
    summary: "通过索引缓存和后台线程，让十万级表格保持流畅。",
    category: "Qt",
    publishedAt: "2025-01-20",
    readingTime: 15,
  },
];

describe("文章目录筛选与排序", () => {
  test("按关键词匹配标题、摘要与分类，忽略大小写与首尾空白", () => {
    const result = filterAndSortArticles(fixtures, {
      query: "  RUST ",
      category: "",
      sort: "newest",
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.slug).toBe("rust-ownership");
  });

  test("分类筛选只保留指定分类", () => {
    const result = filterAndSortArticles(fixtures, {
      query: "",
      category: "C++",
      sort: "newest",
    });

    expect(result.map((item) => item.slug)).toEqual(["cpp-cmake"]);
  });

  test("关键词与分类可以组合筛选", () => {
    const result = filterAndSortArticles(fixtures, {
      query: "索引",
      category: "Qt",
      sort: "newest",
    });

    expect(result.map((item) => item.slug)).toEqual(["qt-model-view"]);
  });

  test("按日期新旧排序", () => {
    const newest = filterAndSortArticles(fixtures, {
      query: "",
      category: "",
      sort: "newest",
    });
    const oldest = filterAndSortArticles(fixtures, {
      query: "",
      category: "",
      sort: "oldest",
    });

    expect(newest.map((item) => item.slug)).toEqual([
      "qt-model-view",
      "rust-ownership",
      "cpp-cmake",
    ]);
    expect(oldest.map((item) => item.slug)).toEqual([
      "cpp-cmake",
      "rust-ownership",
      "qt-model-view",
    ]);
  });

  test("按标题升序与降序排序", () => {
    const asc = filterAndSortArticles(fixtures, {
      query: "",
      category: "",
      sort: "title-asc",
    });
    const desc = filterAndSortArticles(fixtures, {
      query: "",
      category: "",
      sort: "title-desc",
    });

    const original = fixtures.map((item) => item.title).sort();
    const ascTitles = asc.map((item) => item.title);
    const descTitles = desc.map((item) => item.title);

    expect(ascTitles.slice().sort()).toEqual(original);
    expect(descTitles).toEqual(ascTitles.slice().reverse());
    expect(descTitles.slice().sort()).toEqual(original);
  });

  test("筛选与排序不会修改传入数组", () => {
    const before = fixtures.map((item) => item.slug);

    filterAndSortArticles(fixtures, {
      query: "C++",
      category: "",
      sort: "oldest",
    });

    expect(fixtures.map((item) => item.slug)).toEqual(before);
  });
});

describe("分类提取", () => {
  test("返回去重且稳定排序的分类列表", () => {
    const withDuplicate: ArticleItem[] = [
      fixtures[1]!,
      fixtures[0]!,
      fixtures[1]!,
    ];

    expect(collectCategories(withDuplicate)).toEqual(["C++", "Rust"]);
  });
});

describe("文章目录条目转换", () => {
  test("保留二级与三级标题并映射层级，过滤一级标题", () => {
    const entries = getTocEntries([
      { depth: 1, slug: "root", text: "文章标题" },
      { depth: 2, slug: "section-a", text: "第一节" },
      { depth: 3, slug: "section-a-1", text: "第一小节" },
      { depth: 4, slug: "deep", text: "过深标题" },
    ]);

    expect(entries).toEqual([
      { id: "section-a", text: "第一节", level: 2 },
      { id: "section-a-1", text: "第一小节", level: 3 },
    ]);
  });
});
