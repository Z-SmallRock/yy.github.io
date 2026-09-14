# 十六个人网站

这是一个使用 Astro 构建的静态个人网站，首页采用现代水墨山水视觉，文章保存在项目本地，不依赖数据库或远程内容服务。

## 环境要求

- Node.js 24
- npm

## 安装与运行

```powershell
npm install
npm run dev
```

默认开发地址为 `http://localhost:4321/`。

## 添加文章

在 `src/content/articles/` 下新建 `.md` 文件。文件头必须包含以下字段：

```markdown
---
title: 文章标题
slug: article-slug
publishedAt: '2026-09-07'
updatedAt: '2026-09-07'
category: C++
summary: 一句话摘要
readingTime: 3
sourceId: 'manual-001'
---

这里开始写正文。
```

注意事项：

- `slug` 必须唯一，建议只使用中文、英文、数字和连字符。
- `sourceId` 必须唯一；手动文章可使用 `manual-001` 这类编号。
- 正文图片放入 `public/images/articles/<slug>/`。
- Markdown 中使用 `/images/articles/<slug>/图片名.webp` 引用图片。
- 不要在正文中保留原平台链接、品牌、广告、登录提示或推荐内容。

## 导入公开文章

项目保留了公开页面导入工具。它不使用账号、Cookie 或私有接口。

只检查可发现的文章：

```powershell
npm run import:csdn -- --url "公开博客主页地址" --dry-run
```

导入文章：

```powershell
npm run import:csdn -- --url "公开博客主页地址" --max-retries 2
```

目标站点可能限制自动请求。发生失败时，查看 `outputs/import-report.json`，并优先按上面的格式手动添加文章。

## 验证与构建

```powershell
npm run test
npm run build
```

构建产物位于 `dist/`。

## GitHub Pages

工作流位于 `.github/workflows/deploy.yml`。在仓库设置中：

1. 将 Pages 的 Source 设置为 GitHub Actions。
2. 可选设置仓库变量 `SITE_URL`，例如 `https://username.github.io`。
3. 项目站点设置 `BASE_PATH` 为 `/<repository-name>`；用户主页仓库设置为 `/`。
4. 推送默认分支后，工作流会测试、构建并部署 `dist/`。

## 内容权利

导入和发布前，请确认自己拥有文章与图片的再发布权。站点只应保存你有权公开的内容。
