# 添加文章

站点文章保存在 `src/content/articles/`，图片保存在
`public/images/articles/`。文章文件名、frontmatter 中的 `slug` 和图片目录名
必须保持一致。

## 1. 创建文章文件

先确定稳定且唯一的 `<slug>`，再创建：

```text
src/content/articles/<slug>.md
```

例如：

```text
src/content/articles/windows-compile-example.md
```

不要使用目录序号或临时名称作为 slug。文章发布后，修改 slug 会同时改变页面地址、
文件名和图片目录。

## 2. 填写 frontmatter

每篇文章必须包含以下七个字段：

- `title`：文章标题。
- `slug`：唯一地址标识，必须与 Markdown 文件名一致。
- `publishedAt`：发布日期，建议使用 `YYYY-MM-DD`。
- `category`：文章分类。
- `summary`：文章摘要。
- `readingTime`：正整数，表示预计阅读分钟数。
- `sourceId`：全站唯一的稳定来源 ID；手工文章可使用 `manual-<slug>`。

`updatedAt` 是可选字段。文章有明确更新日期时再填写，否则删除该行。

下面是完整、可直接复制的文章示例：

````markdown
---
title: Windows 下编译示例库
slug: windows-compile-example
publishedAt: "2026-09-10"
updatedAt: "2026-09-10"
category: C++
summary: 记录在 Windows 环境中配置工具链并编译示例库的完整过程。
readingTime: 5
sourceId: "manual-windows-compile-example"
---

## 准备环境

安装编译器和 CMake，并确认命令行可以找到它们。

## 编译

```powershell
cmake -S . -B build
cmake --build build --config Release
```

![Release 编译结果](/images/articles/windows-compile-example/build-result.webp)
````

## 3. 添加图片

为文章创建与 slug 同名的图片目录：

```text
public/images/articles/<slug>/
```

上面示例对应的目录和文件是：

```text
public/images/articles/windows-compile-example/build-result.webp
```

推荐使用 WebP。图片文件名应稳定、可读，并避免空格。

## 4. 引用图片

正文使用从站点根目录开始的绝对路径：

```markdown
![说明](/images/articles/<slug>/image.webp)
```

例如：

```markdown
![Release 编译结果](/images/articles/windows-compile-example/build-result.webp)
```

不要使用本机磁盘路径、`src/content` 相对路径或远程图片地址。测试会检查每个
`/images/articles/...` 引用能否在 `public` 下找到对应文件，并拒绝远程平台图片。

## 5. 验证

新增文章后，先把
`tests/content/article-integrity.test.ts` 中的精确文章总数同步为当前数量，然后依次运行：

```powershell
npm test
npx tsc --noEmit -p tsconfig.json
npm run build
```

验证通过前，重点检查：

- 文件名是否为 `<slug>.md`。
- `slug` 和 `sourceId` 是否全站唯一。
- 七个必填字段是否完整，日期和 `readingTime` 是否有效。
- 每个本地图片引用是否存在对应文件。
- 发布正文是否还包含远程平台链接、品牌文本、占位图片或拖拽提示。
