import { describe, expect, test } from "vitest";
import { sanitizeLocalMarkdown } from "../../scripts/import-csdn/sanitize-markdown";

describe("sanitizeLocalMarkdown", () => {
  test("删除平台残留与占位图，同时保留有效外链和正文", () => {
    const input = [
      "\u200B编辑",
      "点击并拖拽以移动",
      "![占位](data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==)",
      "[原文](https://blog.csdn.net/qq_27395289/article/details/1)",
      "[Boost](https://www.boost.org/)",
      "正文包含编辑器这个正常词语。",
    ].join("\n\n");

    const result = sanitizeLocalMarkdown(input, "测试文章");

    expect(result).not.toMatch(
      /CSDN|csdn\.net|data:image\/gif|点击并拖拽以移动/iu,
    );
    expect(result).not.toMatch(/^编辑$/mu);
    expect(result).toContain("[Boost](https://www.boost.org/)");
    expect(result).toContain("正文包含编辑器这个正常词语。");
  });

  test("去除重复首标题并规范空白和未闭合代码围栏", () => {
    const input = [
      "# 正式标题",
      "",
      "",
      "## 小节  ",
      "",
      "```cpp",
      "int main() {}",
    ].join("\n");

    expect(sanitizeLocalMarkdown(input, "正式标题")).toBe(
      "## 小节\n\n```cpp\nint main() {}\n```\n",
    );
  });

  test("保留待下载的远程文章图片", () => {
    const image =
      "![示意图](https://i-blog.csdnimg.cn/blog_migrate/example.png)";

    expect(sanitizeLocalMarkdown(image, "图片文章")).toBe(`${image}\n`);
  });

  test("解开 CSDN 链接时保留有意义的链接文字", () => {
    const result = sanitizeLocalMarkdown(
      "参考[原文中的步骤](https://blog.csdn.net/qq_27395289/article/details/1)继续操作。",
      "测试文章",
    );

    expect(result).toBe("参考原文中的步骤继续操作。\n");
  });

  test("删除紧跟在图片后的编辑标记", () => {
    const image = "![编译结果](/images/articles/example/result.webp)";

    expect(sanitizeLocalMarkdown(`${image}编辑`, "图片文章")).toBe(
      `${image}\n`,
    );
  });

  test("保留空说明真实图片并移除同一行的 GIF 占位图", () => {
    const image =
      "![](https://i-blog.csdnimg.cn/blog_migrate/example.png)";
    const placeholder =
      '![](data:image/gif;base64,R0lGODlhAQABAAAAACw= "点击并拖拽以移动")';

    expect(
      sanitizeLocalMarkdown(`${image}${placeholder}\u200B编辑`, "图片文章"),
    ).toBe(`${image}\n`);
  });

  test("删除空文字链接及其残留的加粗标记", () => {
    const input =
      "4. ****[](https://example.com/install-python)**安装 Python 2.7**";

    expect(sanitizeLocalMarkdown(input, "安装指南")).toBe(
      "4. **安装 Python 2.7**\n",
    );
  });
});
