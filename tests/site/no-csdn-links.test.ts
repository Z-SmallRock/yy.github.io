import path from "node:path";
import { describe, expect, test } from "vitest";
import { findProhibitedPublishedContent } from "../../scripts/content-gate";

const contentDir = path.resolve("src/content/articles");

describe("站点内容外部依赖门禁", () => {
  test("源文章不包含 CSDN 残留或拖拽占位文本", async () => {
    // outputs 下的迁移报告为审计用途，有意保留原始 sourceUrl，不属于发布内容。
    // dist 由 postbuild 在刚生成后扫描，避免旧构建产物造成假通过。
    const violations = await findProhibitedPublishedContent([contentDir]);

    expect(violations, violations.join("\n")).toEqual([]);
  });
});
