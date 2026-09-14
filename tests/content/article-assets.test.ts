import path from "node:path";
import { describe, expect, test } from "vitest";
import { findArticleAssetViolations } from "../../scripts/content-gate";

const contentDir = path.resolve("src/content/articles");
const publicDir = path.resolve("public");

describe("文章图片资源", () => {
  test("本地图片必须存在且 Markdown 不允许引用 CSDN 远程图片", async () => {
    const violations = await findArticleAssetViolations(
      contentDir,
      publicDir,
    );

    expect(violations, violations.join("\n")).toEqual([]);
  });
});
