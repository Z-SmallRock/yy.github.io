import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, test } from "vitest";
import { downloadArticleAssets } from "../../scripts/import-csdn/download-assets";
import type { FetchLike } from "../../scripts/import-csdn/types";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function makePublicDir(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "csdn-assets-"));
  temporaryRoots.push(root);
  return root;
}

function makeImageResponse(): Response {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  return new Response(png, {
    status: 200,
    headers: { "content-type": "image/png", "content-length": String(png.byteLength) },
  });
}

describe("downloadArticleAssets", () => {
  test("下载远程图片、确定性转换为 WebP 并改写 Markdown", async () => {
    const publicDir = await makePublicDir();
    const calls: string[] = [];
    const fetchImpl: FetchLike = async (input) => {
      calls.push(String(input));
      return makeImageResponse();
    };
    const markdown = "![图一](https://i-blog.csdnimg.cn/blog_migrate/a.png)\n\n![图一](https://i-blog.csdnimg.cn/blog_migrate/a.png)";

    const first = await downloadArticleAssets(markdown, "测试文章", publicDir, {
      fetch: fetchImpl,
      retries: 0,
      timeoutMs: 1000,
    });
    const second = await downloadArticleAssets(markdown, "测试文章", publicDir, {
      fetch: fetchImpl,
      retries: 0,
      timeoutMs: 1000,
    });

    expect(calls).toHaveLength(1);
    expect(first.assets).toHaveLength(1);
    expect(first.assets[0]?.status).toBe("downloaded");
    expect(first.markdown).toMatch(/!\[图一\]\(\/images\/articles\/测试文章\/[a-f0-9]+\.webp\)/);
    expect(second.markdown).toBe(first.markdown);
    const files = await readdir(path.join(publicDir, "images", "articles", "测试文章"));
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/\.webp$/);
    const imageBytes = await readFile(path.join(publicDir, "images", "articles", "测试文章", files[0]!));
    expect((await sharp(imageBytes).metadata()).format).toBe("webp");
  });

  test("下载失败时移除远程图片引用并返回失败记录", async () => {
    const publicDir = await makePublicDir();
    const fetchImpl: FetchLike = async () => new Response("nope", { status: 503 });
    const markdown = "前文\n\n![不可用](https://i-blog.csdnimg.cn/missing.png)\n\n后文";

    const result = await downloadArticleAssets(markdown, "失败文章", publicDir, {
      fetch: fetchImpl,
      retries: 0,
      timeoutMs: 1000,
    });

    expect(result.markdown).toBe("前文\n\n后文");
    expect(result.assets).toEqual([
      expect.objectContaining({
        sourceUrl: "https://i-blog.csdnimg.cn/missing.png",
        status: "failed",
      }),
    ]);
  });

  test("拒绝非图片响应和超出大小限制的响应", async () => {
    const publicDir = await makePublicDir();
    let mode = "html";
    const fetchImpl: FetchLike = async () =>
      mode === "html"
        ? new Response("<html>no</html>", { status: 200, headers: { "content-type": "text/html" } })
        : new Response(new Uint8Array(20), { status: 200, headers: { "content-type": "image/png" } });
    const htmlResult = await downloadArticleAssets("![x](https://i-blog.csdnimg.cn/x.png)", "限制文章", publicDir, { fetch: fetchImpl, retries: 0, timeoutMs: 1000 });
    mode = "large";
    const largeResult = await downloadArticleAssets("![x](https://i-blog.csdnimg.cn/y.png)", "限制文章", publicDir, { fetch: fetchImpl, retries: 0, timeoutMs: 1000, maxBytes: 10 });

    expect(htmlResult.assets[0]?.error).toMatch(/content-type/i);
    expect(largeResult.assets[0]?.error).toMatch(/size|bytes/i);
    expect(largeResult.markdown).not.toContain("https://i-blog.csdnimg.cn/y.png");
  });

  test("拒绝非文章图片域名和跨域重定向", async () => {
    const publicDir = await makePublicDir();
    const fetchImpl: FetchLike = async () =>
      new Response(null, {
        status: 302,
        headers: { location: "http://127.0.0.1/private.png" },
      });

    const rejectedHost = await downloadArticleAssets(
      "![x](http://127.0.0.1/private.png)",
      "安全文章",
      publicDir,
      { fetch: fetchImpl, retries: 0, timeoutMs: 1000 },
    );
    const rejectedRedirect = await downloadArticleAssets(
      "![x](https://i-blog.csdnimg.cn/redirect.png)",
      "安全文章",
      publicDir,
      { fetch: fetchImpl, retries: 0, timeoutMs: 1000 },
    );

    expect(rejectedHost.assets[0]?.error).toMatch(/host|allowed/i);
    expect(rejectedRedirect.assets[0]?.error).toMatch(/host|allowed/i);
  });

  test("流式响应超过大小上限时立即失败", async () => {
    const publicDir = await makePublicDir();
    const fetchImpl: FetchLike = async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(8));
            controller.enqueue(new Uint8Array(8));
            controller.close();
          },
        }),
        {
          status: 200,
          headers: { "content-type": "image/png" },
        },
      );

    const result = await downloadArticleAssets(
      "![x](https://i-blog.csdnimg.cn/chunked.png)",
      "流式限制",
      publicDir,
      { fetch: fetchImpl, retries: 0, timeoutMs: 1000, maxBytes: 10 },
    );

    expect(result.assets[0]?.error).toMatch(/size|bytes/i);
    expect(result.markdown).not.toContain("https://i-blog.csdnimg.cn/chunked.png");
  });
});
