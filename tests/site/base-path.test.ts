import { describe, expect, test } from "vitest";
import { normalizeBasePath, prefixBasePath } from "../../site-path.mjs";

describe("Astro 基础路径配置", () => {
  test("项目子路径始终以斜杠结尾，便于安全拼接站内链接", async () => {
    expect(normalizeBasePath("/demo")).toBe("/demo/");
    expect(normalizeBasePath("demo")).toBe("/demo/");
    expect(normalizeBasePath("/")).toBe("/");
    expect(prefixBasePath("/demo/", "/images/hero.webp")).toBe(
      "/demo/images/hero.webp",
    );
    expect(prefixBasePath("/", "/images/hero.webp")).toBe("/images/hero.webp");
  });
});
