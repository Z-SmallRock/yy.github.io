import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  findArticleAssetViolations,
  findProhibitedPublishedContent,
} from "../../scripts/content-gate";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function makeTemporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "content-gate-"));
  temporaryRoots.push(root);
  return root;
}

describe("发布内容门禁", () => {
  test("构建流程在 Astro 生成 dist 后执行内容扫描", async () => {
    const packageJson = JSON.parse(
      await readFile(path.resolve("package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.postbuild).toBe(
      "tsx scripts/content-gate.ts",
    );
  });

  test("扫描指定发布目录中的平台残留", async () => {
    const root = await makeTemporaryRoot();
    const contentDir = path.join(root, "src", "content", "articles");
    const distDir = path.join(root, "dist");
    await mkdir(contentDir, { recursive: true });
    await mkdir(distDir, { recursive: true });
    await writeFile(path.join(contentDir, "clean.md"), "正文", "utf8");
    await writeFile(
      path.join(distDir, "index.html"),
      '<a href="https://blog.csdn.net/example">残留链接</a>',
      "utf8",
    );

    const violations = await findProhibitedPublishedContent([
      contentDir,
      distDir,
    ]);

    expect(violations.map((violation) => violation.replaceAll("\\", "/"))).toEqual(
      [expect.stringContaining("dist/index.html:1")],
    );
  });
});

describe("文章图片门禁", () => {
  test("识别带括号目标、尖括号目标和引用式图片", async () => {
    const root = await makeTemporaryRoot();
    const contentDir = path.join(root, "articles");
    const publicDir = path.join(root, "public");
    const imageDir = path.join(publicDir, "images", "articles", "demo");
    await mkdir(contentDir, { recursive: true });
    await mkdir(imageDir, { recursive: true });
    await Promise.all([
      writeFile(path.join(imageDir, "inline(1).webp"), "image"),
      writeFile(path.join(imageDir, "reference image.webp"), "image"),
    ]);
    await writeFile(
      path.join(contentDir, "demo.md"),
      [
        "![括号图](/images/articles/demo/inline(1).webp)",
        "![引用图][diagram]",
        "",
        '[diagram]: </images/articles/demo/reference image.webp> "示意图"',
      ].join("\n"),
      "utf8",
    );

    await expect(
      findArticleAssetViolations(contentDir, publicDir),
    ).resolves.toEqual([]);
  });

  test("拒绝解码后越出文章图片目录的 Windows 路径", async () => {
    const root = await makeTemporaryRoot();
    const contentDir = path.join(root, "articles");
    const publicDir = path.join(root, "public");
    await mkdir(contentDir, { recursive: true });
    await mkdir(publicDir, { recursive: true });
    await writeFile(
      path.join(contentDir, "escape.md"),
      "![越界图](/images/articles/%5C..%5C..%5C..%5Coutside.webp)",
      "utf8",
    );

    const violations = await findArticleAssetViolations(
      contentDir,
      publicDir,
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(/越出.*public[\\/]images[\\/]articles/u);
  });

  test("拒绝编码目录前缀后越出文章图片目录的路径", async () => {
    const root = await makeTemporaryRoot();
    const contentDir = path.join(root, "articles");
    const publicDir = path.join(root, "public");
    await mkdir(contentDir, { recursive: true });
    await mkdir(publicDir, { recursive: true });
    await writeFile(
      path.join(contentDir, "encoded-prefix.md"),
      "![越界图](/images%2Farticles%2F..%2F..%2Foutside.webp)",
      "utf8",
    );

    const violations = await findArticleAssetViolations(
      contentDir,
      publicDir,
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(/越出.*public[\\/]images[\\/]articles/u);
  });

  test("拒绝协议相对且主机名经过编码的 CSDN 图片", async () => {
    const root = await makeTemporaryRoot();
    const contentDir = path.join(root, "articles");
    const publicDir = path.join(root, "public");
    await mkdir(contentDir, { recursive: true });
    await mkdir(publicDir, { recursive: true });
    await writeFile(
      path.join(contentDir, "remote.md"),
      "![远程图](//i-blog.%63sdnimg.cn/example.webp)",
      "utf8",
    );

    const violations = await findArticleAssetViolations(
      contentDir,
      publicDir,
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("不允许引用 CSDN 远程图片");
  });

  test("拒绝混合斜杠且主机名经过编码的 CSDN 图片", async () => {
    const root = await makeTemporaryRoot();
    const contentDir = path.join(root, "articles");
    const publicDir = path.join(root, "public");
    await mkdir(contentDir, { recursive: true });
    await mkdir(publicDir, { recursive: true });
    await writeFile(
      path.join(contentDir, "mixed-slashes.md"),
      String.raw`![远程图](https:/\i-blog.%63sdnimg.cn/example.webp)`,
      "utf8",
    );

    const violations = await findArticleAssetViolations(
      contentDir,
      publicDir,
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("不允许引用 CSDN 远程图片");
  });

  test("拒绝文章图片目录外的本地路径和文件 URL", async () => {
    const root = await makeTemporaryRoot();
    const contentDir = path.join(root, "articles");
    const publicDir = path.join(root, "public");
    await mkdir(contentDir, { recursive: true });
    await mkdir(publicDir, { recursive: true });
    await writeFile(
      path.join(contentDir, "outside-local.md"),
      [
        "![相对路径](outside.webp)",
        "![Windows 路径](C:/outside.webp)",
        "![文件 URL](file:///C:/outside.webp)",
      ].join("\n"),
      "utf8",
    );

    const violations = await findArticleAssetViolations(
      contentDir,
      publicDir,
    );

    expect(violations).toHaveLength(3);
    expect(violations).toEqual([
      expect.stringContaining("public/images/articles"),
      expect.stringContaining("不允许使用本地文件 URL"),
      expect.stringContaining("不允许使用本地文件 URL"),
    ]);
  });
});
