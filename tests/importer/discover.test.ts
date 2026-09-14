import { describe, expect, test } from "vitest";
import {
  discoverArticleIndex,
  fetchBusinessListJson,
  fetchHtml,
} from "../../scripts/import-csdn/discover";
import type { FetchLike } from "../../scripts/import-csdn/types";

function makeFetcher(routes: Record<string, string>) {
  const calls: string[] = [];
  const fetchImpl: FetchLike = async (input) => {
    const url = String(input);
    calls.push(url);
    const html = routes[url];
    if (html === undefined) {
      return new Response("not found", { status: 404 });
    }
    return new Response(html, {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  };

  return { fetchImpl, calls };
}

const listOne = "https://blog.csdn.net/shiliu/article/list/1";
const listTwo = "https://blog.csdn.net/article/list/2";
const listThree = "https://blog.csdn.net/article/list/3";
const profileUrl = "https://blog.csdn.net/qq_27395289";
const businessApiUrl =
  "https://blog.csdn.net/community/home-api/v1/get-business-list?page=1&size=100&businessType=blog&orderby=&noMore=false&year=&month=&username=qq_27395289";

describe("discoverArticleIndex", () => {
  test("公开个人主页优先使用博客列表 API 并映射完整元数据", async () => {
    const { fetchImpl, calls } = makeFetcher({
      [businessApiUrl]: JSON.stringify({
        code: 200,
        data: {
          total: 2,
          list: [
            {
              articleId: 101,
              title: "第一篇",
              description: "摘要一",
              url: "https://blog.csdn.net/qq_27395289/article/details/101",
              postTime: "2024-03-11 10:00:00",
              tags: ["C++", "Qt"],
            },
            {
              articleId: 102,
              title: "第二篇",
              description: "摘要二",
              url: "https://blog.csdn.net/qq_27395289/article/details/102?spm=x",
              formatTime: "2024.03.12",
              tags: [],
            },
          ],
        },
      }),
    });

    const items = await discoverArticleIndex(profileUrl, {
      fetch: fetchImpl,
      retries: 0,
      timeoutMs: 1000,
    });

    expect(calls).toEqual([businessApiUrl]);
    expect(items).toEqual([
      {
        url: "https://blog.csdn.net/qq_27395289/article/details/101",
        sourceId: "101",
        title: "第一篇",
        category: "C++",
        publishedAt: "2024-03-11",
        summary: "摘要一",
      },
      {
        url: "https://blog.csdn.net/qq_27395289/article/details/102",
        sourceId: "102",
        title: "第二篇",
        category: "",
        publishedAt: "2024-03-12",
        summary: "摘要二",
      },
    ]);
  });

  test("发现可见文章详情链接，清除 query/hash、去重并派生 sourceId", async () => {
    const { fetchImpl } = makeFetcher({
      [listOne]: `
        <html><body>
          <a href="/article/details/101">第一篇</a>
          <a href="/article/details/101?from=timeline">第一篇重复</a>
          <a
            href="/article/details/102"
            data-category="Rust"
            data-published-at="2024-03-11"
            data-summary="第二篇摘要"
          >理解 Rust 所有权</a>
          <a href="/article/details/103?from=timeline#comments">带查询 &amp; 锚点</a>
          <a href="/blog/not-an-article">不应收集</a>
        </body></html>
      `,
    });

    const items = await discoverArticleIndex(listOne, {
      fetch: fetchImpl,
      retries: 0,
      timeoutMs: 1000,
    });

    expect(items).toEqual([
      {
        url: "https://blog.csdn.net/article/details/101",
        sourceId: "101",
        title: "第一篇",
        category: "",
        publishedAt: "",
        summary: "",
      },
      {
        url: "https://blog.csdn.net/article/details/102",
        sourceId: "102",
        title: "理解 Rust 所有权",
        category: "Rust",
        publishedAt: "2024-03-11",
        summary: "第二篇摘要",
      },
      {
        url: "https://blog.csdn.net/article/details/103",
        sourceId: "103",
        title: "带查询 & 锚点",
        category: "",
        publishedAt: "",
        summary: "",
      },
    ]);
  });

  test("仅跟随显式“加载更多”分页，直到没有新的文章链接", async () => {
    const { fetchImpl, calls } = makeFetcher({
      [listOne]: `
        <a href="/article/details/101">第一篇</a>
        <a href="/article/list/2" aria-label="加载更多">加载更多</a>
        <a href="/article/list/next">下一页</a>
      `,
      [listTwo]: `
        <a href="/article/details/101">第一篇重复</a>
        <a href="/article/details/103">第三篇</a>
      `,
    });

    const items = await discoverArticleIndex(listOne, {
      fetch: fetchImpl,
      retries: 0,
      timeoutMs: 1000,
    });

    expect(items.map((item) => item.sourceId)).toEqual(["101", "103"]);
    expect(calls).toEqual([listOne, listTwo]);
  });

  test("忽略外域文章链接，也不跟随外域“加载更多”", async () => {
    const { fetchImpl, calls } = makeFetcher({
      [listOne]: `
        <a href="/article/details/101">可见</a>
        <a href="https://evil.example/article/details/105">外域</a>
        <a href="//evil.example/article/details/106">协议相对外域</a>
        <a href="https://evil.example/load-more" aria-label="加载更多">加载更多</a>
      `,
    });

    const items = await discoverArticleIndex(listOne, {
      fetch: fetchImpl,
      retries: 0,
      timeoutMs: 1000,
    });

    expect(items.map((item) => item.sourceId)).toEqual(["101"]);
    expect(calls).toEqual([listOne]);
  });

  test("忽略明显隐藏节点内的文章链接", async () => {
    const { fetchImpl } = makeFetcher({
      [listOne]: `
        <a href="/article/details/101">可见</a>
        <div style="display:none"><a href="/article/details/108">隐藏子节点</a></div>
        <a href="/article/details/109" style="visibility:hidden">隐藏锚点</a>
      `,
    });

    const items = await discoverArticleIndex(listOne, {
      fetch: fetchImpl,
      retries: 0,
      timeoutMs: 1000,
    });

    expect(items.map((item) => item.sourceId)).toEqual(["101"]);
  });

  test("存在真实文章列表容器时忽略侧栏和推荐区的文章链接", async () => {
    const { fetchImpl } = makeFetcher({
      [listOne]: `
        <aside class="recommend-box">
          <a href="/article/details/999">侧栏推荐</a>
        </aside>
        <div class="blog-list-box">
          <a href="/article/details/101">正文文章</a>
        </div>
        <div class="item-loading">
          <a href="/article/list/2">加载更多</a>
        </div>
      `,
      [listTwo]: `
        <div class="blog-list-box">
          <a href="/article/details/102">第二页文章</a>
        </div>
      `,
    });

    const items = await discoverArticleIndex(listOne, {
      fetch: fetchImpl,
      retries: 0,
      timeoutMs: 1000,
    });

    expect(items.map((item) => item.sourceId)).toEqual(["101", "102"]);
  });

  test("当前页没有新增 sourceId 时停止分页", async () => {
    const { fetchImpl, calls } = makeFetcher({
      [listOne]: `
        <a href="/article/details/101">第一篇</a>
        <a href="/article/list/2" aria-label="加载更多">加载更多</a>
      `,
      [listTwo]: `
        <a href="/article/details/101">第一篇重复</a>
        <a href="/article/list/3" aria-label="加载更多">加载更多</a>
      `,
      [listThree]: `
        <a href="/article/details/104">第四篇</a>
      `,
    });

    const items = await discoverArticleIndex(listOne, {
      fetch: fetchImpl,
      retries: 0,
      timeoutMs: 1000,
    });

    expect(items.map((item) => item.sourceId)).toEqual(["101"]);
    expect(calls).toEqual([listOne, listTwo]);
  });

  test("起始 URL 只允许 http/https 且 host 为 csdn.net 或其子域", async () => {
    const { fetchImpl } = makeFetcher({});

    await expect(
      discoverArticleIndex("https://example.com/article/list/1", {
        fetch: fetchImpl,
        retries: 0,
        timeoutMs: 1000,
      }),
    ).rejects.toThrow(/csdn\.net/);

    await expect(
      discoverArticleIndex("ftp://blog.csdn.net/article/list/1", {
        fetch: fetchImpl,
        retries: 0,
        timeoutMs: 1000,
      }),
    ).rejects.toThrow(/protocol/i);
  });

  test("timeout 与 retries 必须是有限非负整数", async () => {
    const { fetchImpl } = makeFetcher({
      [listOne]: `<a href="/article/details/101">第一篇</a>`,
    });

    await expect(
      discoverArticleIndex(listOne, {
        fetch: fetchImpl,
        timeoutMs: -1,
        retries: 0,
      }),
    ).rejects.toThrow(/finite non-negative/);

    await expect(
      discoverArticleIndex(listOne, {
        fetch: fetchImpl,
        timeoutMs: 1000,
        retries: -1,
      }),
    ).rejects.toThrow(/finite non-negative/);
  });

  test("页面没有任何文章链接时返回带页面信息的诊断错误", async () => {
    const { fetchImpl } = makeFetcher({
      [listOne]: `
        <html><body><a href="/blog/about">关于</a></body></html>
      `,
    });

    await expect(
      discoverArticleIndex(listOne, {
        fetch: fetchImpl,
        retries: 0,
        timeoutMs: 1000,
      }),
    ).rejects.toThrow(/No article links found/);
  });
});

describe("fetchHtml", () => {
  test("使用 response.url 作为重定向后的最终 URL", async () => {
    const fetchImpl: FetchLike = async () =>
      ({
        ok: true,
        status: 200,
        text: async () => "<html>ok</html>",
        url: "https://www.csdn.net/article/list/2",
      }) as unknown as Response;

    const result = await fetchHtml(listOne, {
      fetch: fetchImpl,
      retries: 0,
      timeoutMs: 1000,
    });

    expect(result).toEqual({
      html: "<html>ok</html>",
      url: "https://www.csdn.net/article/list/2",
    });
  });

  test("拒绝重定向到外域", async () => {
    const fetchImpl: FetchLike = async () =>
      ({
        ok: true,
        status: 200,
        text: async () => "<html>ok</html>",
        url: "https://evil.example/article/list/2",
      }) as unknown as Response;

    await expect(
      fetchHtml(listOne, {
        fetch: fetchImpl,
        retries: 0,
        timeoutMs: 1000,
      }),
    ).rejects.toThrow(/csdn\.net/);
  });

  test("在发起下一次请求前拒绝重定向到外域", async () => {
    const calls: string[] = [];
    const fetchImpl: FetchLike = async (input) => {
      calls.push(String(input));
      return new Response(null, {
        status: 302,
        headers: { location: "https://evil.example/internal" },
      });
    };

    await expect(
      fetchHtml(listOne, {
        fetch: fetchImpl,
        retries: 0,
        timeoutMs: 1000,
      }),
    ).rejects.toThrow(/csdn\.net/);
    expect(calls).toEqual([listOne]);
  });

  test("HTML 响应超过大小限制时停止读取", async () => {
    const fetchImpl: FetchLike = async () =>
      new Response("12345678901234567890", { status: 200 });

    await expect(
      fetchHtml(listOne, {
        fetch: fetchImpl,
        retries: 0,
        timeoutMs: 1000,
        maxBytes: 10,
      }),
    ).rejects.toThrow(/size|bytes/i);
  });

  test("业务 API JSON 响应超过大小限制时停止读取", async () => {
    const fetchImpl: FetchLike = async () =>
      new Response("12345678901234567890", { status: 200 });

    await expect(
      fetchBusinessListJson(profileUrl, profileUrl, {
        fetch: fetchImpl,
        retries: 0,
        timeoutMs: 1000,
        maxBytes: 10,
      }),
    ).rejects.toThrow(/size|bytes/i);
  });
});
