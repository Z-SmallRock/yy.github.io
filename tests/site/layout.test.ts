import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

const stylesheetPath = path.resolve("src/styles/global.css");
const layoutPath = path.resolve("src/layouts/BaseLayout.astro");

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

  test("全局页脚包含延后加载的访问统计和 PV/UV 计数节点", async () => {
    const layout = await readFile(layoutPath, "utf8");

    expect(layout).toMatch(
      /<script\s+is:inline\s+defer\s+src="https:\/\/busuanzi\.9420\.ltd\/js"><\/script>/,
    );
    expect(layout).toContain('id="busuanzi_site_pv"');
    expect(layout).toContain('id="busuanzi_site_uv"');
    expect(layout).toContain("本站访问量");
    expect(layout).toContain("累计访客");
  });
});
