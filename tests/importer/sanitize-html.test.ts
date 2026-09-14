import { describe, expect, test } from "vitest";
import { sanitizeArticleHtml } from "../../scripts/import-csdn/sanitize-html";

const sourceUrl = "https://blog.csdn.net/qq_27395289/article/details/127750691";

const articleHtml = `
<!doctype html>
<html>
  <head>
    <title>测试文章 - CSDN博客</title>
    <meta property="article:published_time" content="2024-04-01T10:00:00+08:00">
    <meta property="article:modified_time" content="2024-04-02T10:00:00+08:00">
    <meta name="description" content="这是一段来自元数据的摘要">
  </head>
  <body>
    <header>站点导航 CSDN</header>
    <div class="login-box">登录后查看更多</div>
    <div class="recommend-box">推荐阅读</div>
    <main>
      <h1 class="title-article">测试文章</h1>
      <div class="blog-tags-box"><a>TypeScript</a></div>
      <div id="content_views">
        <svg><script>alert("x")</script></svg>
        <p>正文开始，包含 <strong>重点</strong>、<em>强调</em> 和 <a href="https://blog.csdn.net/other">CSDN来源</a>。</p>
        <h2>实现细节</h2>
        <h3>列表与引用</h3>
        <ul><li>第一项</li><li>第二项</li></ul>
        <ol><li>步骤一</li></ol>
        <blockquote><p>保持输入原样看待。</p></blockquote>
        <table><thead><tr><th>字段</th><th>值</th></tr></thead><tbody><tr><td>语言</td><td>TypeScript</td></tr></tbody></table>
        <pre class="new-version set-code-show"><code class="prism language-typescript"><span class="pre-numbering">1</span>const answer = 42;</code><div class="opt-box">复制</div></pre>
        <p><img src="/images/diagram.png" alt="架构图"></p>
        <p><img src="https://developer.mozilla.org/docs/Web/JavaScript" alt="not-image"></p>
        <p><a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript">技术文档</a></p>
        <p>来源：CSDN 博客，未经许可不得转载</p>
      </div>
    </main>
    <div class="comment-box">评论区</div>
    <footer>版权与备案</footer>
    <script>document.body.innerHTML = "恶意替换"</script>
  </body>
</html>
`;

describe("sanitizeArticleHtml", () => {
  test("清除页面外壳并保留文章结构、代码、表格、图片和技术链接", () => {
    const result = sanitizeArticleHtml(articleHtml, sourceUrl);

    expect(result.title).toBe("测试文章");
    expect(result.publishedAt).toBe("2024-04-01");
    expect(result.updatedAt).toBe("2024-04-02");
    expect(result.category).toBe("TypeScript");
    expect(result.summary).toBe("这是一段来自元数据的摘要");
    expect(result.sourceLinksRemoved).toBe(1);
    expect(result.markdown).toMatch(/^# 测试文章/m);
    expect(result.markdown).toContain("## 实现细节");
    expect(result.markdown).toContain("### 列表与引用");
    expect(result.markdown).toContain("- 第一项");
    expect(result.markdown).toContain("1. 步骤一");
    expect(result.markdown).toContain("> 保持输入原样看待。");
    expect(result.markdown).toContain("| 字段 | 值 |");
    expect(result.markdown).toContain("```typescript");
    expect(result.markdown).toContain("const answer = 42;");
    expect(result.markdown).toContain("![架构图](https://blog.csdn.net/images/diagram.png)");
    expect(result.markdown).toContain("[技术文档](https://developer.mozilla.org/en-US/docs/Web/JavaScript)");
    expect(result.markdown).not.toContain("CSDN来源");
    expect(result.markdown).not.toContain("CSDN 博客");
    expect(result.markdown).not.toContain("复制");
    expect(result.markdown).not.toContain("恶意替换");
  });

  test("缺少文章容器或正文为空时返回带来源 URL 的诊断错误", () => {
    expect(() => sanitizeArticleHtml("<html><body><p>无正文</p></body></html>", sourceUrl))
      .toThrow(new RegExp(sourceUrl));
    expect(() => sanitizeArticleHtml('<div id="content_views"></div>', sourceUrl))
      .toThrow(new RegExp(sourceUrl));
  });

  test("支持备用正文容器并保证只有一个一级标题", () => {
    const result = sanitizeArticleHtml(
      `<html><head><title>备用标题</title></head><body>
        <article class="article_content"><h1>正文标题</h1><h1>错误层级</h1><p>内容</p></article>
      </body></html>`,
      sourceUrl,
    );

    expect(result.markdown.match(/^# /gm)).toHaveLength(1);
    expect(result.markdown).toContain("## 正文标题");
    expect(result.markdown).toContain("## 错误层级");
  });

  test("移除隐藏外壳和跟踪图片，并保留懒加载正文图片", () => {
    const result = sanitizeArticleHtml(
      `<html><head><title>图片测试</title></head><body>
        <article>
          <header>正文内导航</header>
          <nav>快捷入口</nav>
          <div style="display: none">隐藏提示</div>
          <p>可见正文</p>
          <img class="avatar" src="https://i-blog.csdnimg.cn/avatar.png">
          <img width="1" height="1" src="https://i-blog.csdnimg.cn/tracker.png">
          <img data-src="https://i-blog.csdnimg.cn/content.png" alt="正文图">
          <footer>正文内页脚</footer>
        </article>
      </body></html>`,
      sourceUrl,
    );

    expect(result.markdown).toContain("可见正文");
    expect(result.markdown).toContain(
      "![正文图](https://i-blog.csdnimg.cn/content.png)",
    );
    expect(result.markdown).not.toContain("正文内导航");
    expect(result.markdown).not.toContain("快捷入口");
    expect(result.markdown).not.toContain("隐藏提示");
    expect(result.markdown).not.toContain("avatar.png");
    expect(result.markdown).not.toContain("tracker.png");
    expect(result.markdown).not.toContain("正文内页脚");
  });

  test("来源提示只删除自身，不删除包含它的正文父容器", () => {
    const result = sanitizeArticleHtml(
      `<html><head><title>来源测试</title></head><body>
        <article>
          <div>
            <p>应当保留的正文段落。</p>
            <p>来源：CSDN 博客，转载请附上原文出处</p>
          </div>
        </article>
      </body></html>`,
      sourceUrl,
    );

    expect(result.markdown).toContain("应当保留的正文段落");
    expect(result.markdown).not.toContain("来源：");
  });

  test("Markdown 归一化不会改写代码块内容", () => {
    const result = sanitizeArticleHtml(
      `<html><head><title>代码测试</title></head><body>
        <article>
          <pre><code class="language-markdown"># 一级标题

-  两个空格</code></pre>
        </article>
      </body></html>`,
      sourceUrl,
    );

    expect(result.markdown).toContain("# 一级标题");
    expect(result.markdown).toContain("-  两个空格");
  });
});
