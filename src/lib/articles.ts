export interface ArticleItem {
  slug: string;
  title: string;
  summary: string;
  category: string;
  publishedAt: string;
  readingTime: number;
}

export type SortOrder = "newest" | "oldest" | "title-asc" | "title-desc";

export interface ArticleFilterOptions {
  query: string;
  category: string;
  sort: SortOrder;
}

export interface TocHeading {
  depth: number;
  slug: string;
  text: string;
}

export interface TocEntry {
  id: string;
  text: string;
  level: number;
}

function normalizeDate(value: string): number {
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}

export function filterAndSortArticles(
  items: readonly ArticleItem[],
  options: ArticleFilterOptions,
): ArticleItem[] {
  const query = options.query.trim().toLocaleLowerCase();
  const category = options.category.trim();

  const filtered = items.filter((item) => {
    const matchesQuery =
      query === "" ||
      `${item.title} ${item.summary} ${item.category}`
        .toLocaleLowerCase()
        .includes(query);
    const matchesCategory = category === "" || item.category === category;

    return matchesQuery && matchesCategory;
  });

  return filtered
    .slice()
    .sort((left, right) => {
      switch (options.sort) {
        case "oldest":
          return normalizeDate(left.publishedAt) - normalizeDate(right.publishedAt);
        case "title-asc":
          return left.title.localeCompare(right.title, "zh-CN");
        case "title-desc":
          return right.title.localeCompare(left.title, "zh-CN");
        case "newest":
        default:
          return normalizeDate(right.publishedAt) - normalizeDate(left.publishedAt);
      }
    });
}

export function collectCategories(items: readonly ArticleItem[]): string[] {
  return [...new Set(items.map((item) => item.category))].sort((left, right) =>
    left.localeCompare(right, "zh-CN"),
  );
}

export function getTocEntries(headings: readonly TocHeading[]): TocEntry[] {
  return headings
    .filter((heading) => heading.depth === 2 || heading.depth === 3)
    .map((heading) => ({
      id: heading.slug,
      text: heading.text,
      level: heading.depth,
    }));
}
