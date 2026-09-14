import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

const stylesheetPath = path.resolve("src/styles/global.css");

describe("页面容器布局", () => {
  test("关于页正文使用与其他页面一致的响应式容器", async () => {
    const stylesheet = await readFile(stylesheetPath, "utf8");
    const aboutCopyRule = stylesheet.match(
      /\.about-copy\s*\{([\s\S]*?)\n\}/,
    )?.[1] ?? "";

    expect(aboutCopyRule).toContain(
      "width: min(var(--page-width), calc(100% - 2rem));",
    );
  });
});
