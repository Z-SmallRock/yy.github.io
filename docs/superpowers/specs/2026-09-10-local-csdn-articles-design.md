# 本地 CSDN 文章整理与发布设计

## 目标

将 `C:\ShawnL_Wiki\csdn` 中的 18 篇 Markdown 文章整理后发布到“十六”个人网站。原始目录保持只读，网站内不保留 CSDN 链接、CSDN 图片地址、编辑占位图或平台提示文字。

## 范围

- 导入目录中的全部 18 篇文章。
- 将现有站点中 3 篇同主题文章与本地版本合并去重，最终每个主题只保留一篇。
- 为“未命名.md”生成能描述实际问题的正式标题。
- 保留 GitHub、Boost、Qt 镜像、官方文档等有用的非 CSDN 外链。
- 不对技术结论做大规模改写，只整理标题、章节、代码块、空白、标点和明显的导出残留。

## 内容模型

每篇文章输出为 `src/content/articles/<slug>.md`，包含网站要求的严格 frontmatter：

- `title`：整理后的文章标题。
- `slug`：唯一、稳定的 URL 标识。
- `publishedAt`：原 CSDN 发布日期。
- `updatedAt`：能可靠查询到时保留原更新时间，否则省略。
- `category`：按 C++、Qt、Electron、Chromium、Linux、硬件集成等主题归类。
- `summary`：根据正文生成的一句话摘要。
- `readingTime`：使用现有阅读时长算法计算。
- `sourceId`：优先使用原 CSDN 文章 ID；无法查询时使用唯一的 `local-csdn-*` 编号。

## 日期查询

1. 根据文章标题在作者的公开 CSDN 博客文章列表和公开搜索结果中匹配文章。
2. 标题完全匹配时记录原发布日期和文章 ID。
3. 标题存在轻微差异时，结合正文首段或技术关键词确认，避免误配。
4. 无法可靠匹配时，使用本地文件修改日期 `2026-09-09`，并使用本地唯一 `sourceId`。
5. 不为了补日期而保留任何 CSDN URL。

## 正文整理

整理过程执行以下规则：

1. 删除零宽字符、不间断空格和无意义的首尾空行。
2. 删除 `data:image/gif` 单像素占位图片、“编辑”“点击并拖拽以移动”等导出残留。
3. 删除 CSDN 下载链接、CSDN 原文链接和平台品牌文字。
4. 保留文章正文中的有效外部参考链接。
5. 为裸代码补充 Markdown 代码围栏；能从语法或上下文确认语言时标注 `cpp`、`javascript`、`bash`、`yaml` 或 `json`，无法确认时使用无语言代码围栏。
6. 修复明显破损的标题层级、列表和代码围栏，但不改变文章的核心技术内容。
7. 空图片占位若没有真实图片来源则直接删除，不在正文显示“图片下载失败”。

## 图片本地化

1. 收集 Markdown 中所有 `i-blog.csdnimg.cn`、`img-blog.csdnimg.cn` 和 `img-blog.csdn.net` 图片。
2. 使用现有下载器限制域名、重定向次数、文件大小和响应类型。
3. 下载成功后转换为 WebP，保存到 `public/images/articles/<slug>/`。
4. Markdown 图片路径改写为 `/images/articles/<slug>/<hash>.webp`。
5. 下载失败时记录到导入报告，并删除失效占位，不保留远程 CSDN 地址。

## 去重策略

- `electron package.json 打包配置`、`海康 LED 显示屏网络协议对接` 等现有同主题文章，以本地目录版本为正文基础。
- 保留现有文章能确认的原始发布日期和 `sourceId`，再合并本地版本中更完整的内容。
- 输出前按 `slug` 和规范化标题检查重复，禁止覆盖无关文章。

## 实现边界

新增一个面向本地 Markdown 的整理脚本，复用现有 `downloadArticleAssets`、`calculateReadingTime` 和 `writeArticle`。文章清单与人工确认的元数据单独保存，避免把标题推断、分类和日期规则散落在脚本中。

处理流程：

```text
本地 Markdown
  -> 清理导出残留
  -> 应用文章元数据
  -> 下载并改写图片
  -> 去重写入内容目录
  -> 生成导入报告
  -> 内容完整性检查
```

## 错误处理

- 单篇文章失败不阻断其他文章，最终报告成功、跳过和失败数量。
- 日期匹配不确定时禁止猜测，回退到本地日期。
- 图片下载失败时不保留 CSDN 外链。
- 任何目标文件冲突必须通过 `sourceId` 判定，不能静默覆盖无关内容。
- 原始 `C:\ShawnL_Wiki\csdn` 目录不写入、不重命名、不删除。

## 验证

- 为正文清理、日期回退、占位图片删除、CSDN 链接删除和重复文章处理编写自动化测试。
- 检查最终文章数量和唯一 `slug`。
- 扫描 `src/content/articles` 与 `dist`，确认不存在 `csdn.net`、`csdnimg.cn`、`CSDN` 和 `data:image/gif`。
- 检查所有本地图片引用对应真实文件。
- 运行 `npm test`、`npx tsc --noEmit -p tsconfig.json` 和 `npm run build`。
- 抽查首页、文章列表和至少三篇包含代码或图片的文章页面。
