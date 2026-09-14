# Local CSDN Articles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import all 18 Markdown files from `C:\ShawnL_Wiki\csdn` into the personal site as clean, deduplicated articles with local WebP images and no CSDN references.

**Architecture:** Keep the source directory read-only and add a local-import pipeline beside the existing online CSDN importer. A declarative manifest owns titles, stable slugs, dates, categories, summaries, and source IDs; focused helpers sanitize Markdown, localize images, write content through the existing collision checks, and produce a per-article report.

**Tech Stack:** Astro 5, TypeScript 5, Node.js filesystem APIs, Vitest, gray-matter, sharp.

## Global Constraints

- Read all source Markdown only from `C:\ShawnL_Wiki\csdn`; never modify, rename, or delete source files.
- Import exactly 18 source topics and retain the existing Docker article, producing 19 published articles.
- Prefer verified original CSDN dates and article IDs; otherwise use `2026-09-09` and a stable `local-csdn-*` source ID.
- Remove CSDN links, CSDN branding, `data:image/gif` placeholders, `编辑`, and `点击并拖拽以移动`.
- Preserve useful non-CSDN links such as GitHub, Boost, Qt mirrors, and official documentation.
- Store downloaded images at `public/images/articles/<slug>/<hash>.webp`.
- A failed image download must remove the remote image from Markdown and record the failure without blocking other articles.
- Existing same-topic articles are replaced only when their `sourceId` matches the manifest entry.
- Final content and build output must not contain `csdn.net`, `csdnimg.cn`, `CSDN`, or `data:image/gif`.
- This workspace is not a Git repository, so task checkpoints use tests and file inspection instead of commits.

---

### Task 1: Local Markdown Sanitizer

**Files:**
- Create: `scripts/import-csdn/sanitize-markdown.ts`
- Create: `tests/importer/sanitize-markdown.test.ts`

**Interfaces:**
- Consumes: raw UTF-8 Markdown read from the source directory.
- Produces: `sanitizeLocalMarkdown(markdown: string, title: string): string`.

- [x] **Step 1: Write failing sanitizer tests**

```ts
import { describe, expect, test } from "vitest";
import { sanitizeLocalMarkdown } from "../../scripts/import-csdn/sanitize-markdown";

describe("sanitizeLocalMarkdown", () => {
  test("removes CSDN residue and placeholder images while preserving useful links", () => {
    const input = [
      "\u200B编辑",
      "点击并拖拽以移动",
      "![占位](data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==)",
      "[原文](https://blog.csdn.net/qq_27395289/article/details/1)",
      "[Boost](https://www.boost.org/)",
      "正文",
    ].join("\n\n");
    const result = sanitizeLocalMarkdown(input, "测试文章");
    expect(result).not.toMatch(/CSDN|csdn\.net|data:image\/gif|点击并拖拽|编辑/i);
    expect(result).toContain("[Boost](https://www.boost.org/)");
    expect(result).toContain("正文");
  });

  test("normalizes headings, whitespace, and balanced fenced code", () => {
    const result = sanitizeLocalMarkdown(
      "# 旧标题\n\n\n## 小节  \n\n```cpp\nint main() {}\n",
      "正式标题",
    );
    expect(result).toBe("## 小节\n\n```cpp\nint main() {}\n```\n");
  });
});
```

- [x] **Step 2: Run the focused test and verify failure**

Run: `npx vitest run tests/importer/sanitize-markdown.test.ts`

Expected: FAIL because `sanitize-markdown.ts` does not exist.

- [x] **Step 3: Implement deterministic Markdown cleanup**

Implement `sanitizeLocalMarkdown` with these ordered transformations:

```ts
export function sanitizeLocalMarkdown(markdown: string, title: string): string {
  const normalized = normalizeCharacters(markdown);
  const withoutPlaceholders = removePlaceholderImages(normalized);
  const withoutPlatformResidue = removeCsdnLinksAndBoilerplate(withoutPlaceholders);
  const withoutDuplicateTitle = removeLeadingTitle(withoutPlatformResidue, title);
  return normalizeMarkdownStructure(withoutDuplicateTitle);
}
```

The helper functions must:

- remove zero-width characters and replace non-breaking spaces with normal spaces;
- remove Markdown or HTML images whose source starts with `data:image/gif`;
- unwrap or remove anchors whose resolved host is `csdn.net` or a subdomain;
- remove standalone platform lines and editor drag prompts without deleting ordinary technical sentences;
- remove a leading H1 matching the manifest title or source filename title;
- balance an unmatched final fenced code block and collapse excess blank lines outside code fences;
- return Markdown ending in exactly one newline.

- [x] **Step 4: Run sanitizer tests**

Run: `npx vitest run tests/importer/sanitize-markdown.test.ts`

Expected: PASS.

- [x] **Step 5: Run the full importer test suite**

Run: `npx vitest run tests/importer`

Expected: PASS with no regression in the online importer.

---

### Task 2: Article Metadata Manifest

**Files:**
- Create: `scripts/import-csdn/local-articles.ts`
- Create: `tests/importer/local-articles.test.ts`

**Interfaces:**
- Produces:

```ts
export interface LocalArticleMetadata {
  filename: string;
  title: string;
  slug: string;
  category: string;
  publishedAt: string;
  updatedAt?: string;
  summary: string;
  sourceId: string;
}

export const localArticles: readonly LocalArticleMetadata[];
export function validateLocalArticleManifest(
  entries: readonly LocalArticleMetadata[],
): string[];
```

- [x] **Step 1: Write failing manifest tests**

The tests must assert:

```ts
expect(localArticles).toHaveLength(18);
expect(new Set(localArticles.map((item) => item.filename)).size).toBe(18);
expect(new Set(localArticles.map((item) => item.slug)).size).toBe(18);
expect(new Set(localArticles.map((item) => item.sourceId)).size).toBe(18);
expect(validateLocalArticleManifest(localArticles)).toEqual([]);
expect(localArticles.find((item) => item.filename === "未命名.md")?.title)
  .toBe("Electron preload 加载 Sentry 时出现 Unexpected token import");
```

Also compare the manifest filenames to `C:\ShawnL_Wiki\csdn` when that directory exists.

- [x] **Step 2: Run the focused test and verify failure**

Run: `npx vitest run tests/importer/local-articles.test.ts`

Expected: FAIL because the manifest does not exist.

- [x] **Step 3: Add all 18 metadata records**

Create one explicit record for each source filename. Use verified CSDN dates and numeric IDs where reliable; use `publishedAt: "2026-09-09"` and deterministic IDs from `local-csdn-001` through `local-csdn-018` only for unmatched articles. Set stable slugs explicitly, including the existing slugs:

```ts
{
  filename: "electron package.json 打包配置.md",
  title: "Electron package.json 打包配置",
  slug: "electron-package-json-打包配置",
  category: "Electron",
  publishedAt: "2020-12-25",
  updatedAt: "2020-12-25",
  summary: "一份常用的 Electron Builder 配置示例，包含 Windows 安装包、图标、输出目录和安装选项。",
  sourceId: "111677368",
}
```

```ts
{
  filename: "海康LED显示屏网络协议对接.md",
  title: "海康 LED 显示屏网络协议对接",
  slug: "海康-led-显示屏网络协议对接",
  category: "硬件集成",
  publishedAt: "2018-05-09",
  updatedAt: "2018-05-09",
  summary: "记录 Windows 环境下停车场 LED 显示屏的数据结构、字符编码转换和 TCP/IP 通信实现。",
  sourceId: "80248864",
}
```

`validateLocalArticleManifest` must report duplicate filenames, slugs, source IDs, invalid dates, empty fields, and slugs that do not equal `slugifyTitle(title)`.

- [x] **Step 4: Run manifest tests**

Run: `npx vitest run tests/importer/local-articles.test.ts`

Expected: PASS with all 18 source files represented exactly once.

---

### Task 3: Local Directory Import Pipeline

**Files:**
- Modify: `scripts/import-csdn/types.ts`
- Create: `scripts/import-csdn/import-local.ts`
- Create: `tests/importer/import-local.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes:
  - `localArticles`
  - `sanitizeLocalMarkdown(markdown, title)`
  - `downloadArticleAssets(markdown, slug, publicDir, options)`
  - `calculateReadingTime(markdown)`
  - `writeArticle(document, rootDir, contentDir)`
- Produces:

```ts
export interface LocalImportOptions extends AssetDownloadOptions {
  sourceDir: string;
  rootDir: string;
  contentDir?: string;
  publicDir?: string;
  reportPath?: string;
}

export async function importLocalArticles(
  entries: readonly LocalArticleMetadata[],
  options: LocalImportOptions,
): Promise<ImportResult>;
```

- [x] **Step 1: Write failing local import tests**

Cover these behaviors with temporary directories:

- reads each source file without writing to `sourceDir`;
- sanitizes Markdown and localizes a mocked CSDN image;
- continues after one missing source file;
- writes successful articles with exact manifest metadata;
- reports `discovered`, `written`, `skipped`, failures, removed CSDN links, and assets;
- refuses to overwrite an unrelated article with the same slug;
- uses the manifest slug as the asset folder and final article slug.

- [x] **Step 2: Run the focused test and verify failure**

Run: `npx vitest run tests/importer/import-local.test.ts`

Expected: FAIL because `import-local.ts` does not exist.

- [x] **Step 3: Extend report types for local imports**

Add optional source-file and cleanup details without breaking the online importer:

```ts
export interface FailureRecord {
  sourceId: string;
  url: string;
  sourceFile?: string;
  stage: string;
  message: string;
}

export interface MigrationReport {
  // existing fields
  sourceDirectory?: string;
  removedCsdnReferences?: number;
}
```

- [x] **Step 4: Implement the local pipeline**

For each manifest entry:

```ts
const sourcePath = path.join(options.sourceDir, entry.filename);
const raw = await readFile(sourcePath, "utf8");
const cleaned = sanitizeLocalMarkdown(raw, entry.title);
const localized = await downloadArticleAssets(cleaned, entry.slug, publicDir, options);
const document: ArticleDocument = {
  ...entry,
  readingTime: calculateReadingTime(localized.markdown),
  markdown: localized.markdown,
  assets: localized.assets,
};
await writeArticle(document, rootDir, contentDir);
```

Handle each article inside its own `try/catch`, append a `FailureRecord`, and continue. Before processing, validate the manifest and verify that discovered source filenames match the manifest exactly.

- [x] **Step 5: Add a local import script**

Add:

```json
"import:local": "tsx scripts/import-csdn/import-local.ts"
```

The CLI defaults to:

```text
sourceDir = C:\ShawnL_Wiki\csdn
rootDir = process.cwd()
reportPath = outputs/local-import-report.json
```

Support `--source-dir`, `--content-dir`, `--public-dir`, `--report`, and `--max-retries`.

- [x] **Step 6: Run local pipeline tests**

Run: `npx vitest run tests/importer/import-local.test.ts`

Expected: PASS.

- [x] **Step 7: Run all importer tests**

Run: `npx vitest run tests/importer`

Expected: PASS.

---

### Task 4: Slug-Aware Deduplication and Failed Image Cleanup

**Files:**
- Modify: `scripts/import-csdn/write-content.ts`
- Modify: `scripts/import-csdn/download-assets.ts`
- Modify: `tests/importer/write-content.test.ts`
- Modify: `tests/importer/download-assets.test.ts`

**Interfaces:**
- `writeArticle` accepts an explicit manifest slug only when it is safe and normalized.
- Failed CSDN image references are deleted rather than replaced by visible placeholder text.

- [x] **Step 1: Add failing regression tests**

Add cases proving:

```ts
await writeArticle(
  makeDocument({
    title: "海康 LED 显示屏网络协议对接",
    slug: "海康-led-显示屏网络协议对接",
    sourceId: "80248864",
  }),
  root,
);
```

writes the exact manifest slug, while `../escape` and slugs containing separators remain rejected. Add a failed-image assertion:

```ts
expect(result.markdown).toBe("前文\n\n后文");
```

- [x] **Step 2: Run focused tests and verify failure**

Run: `npx vitest run tests/importer/write-content.test.ts tests/importer/download-assets.test.ts`

Expected: FAIL because explicit stable slugs are currently rejected and failed images leave placeholder text.

- [x] **Step 3: Permit validated explicit slugs**

Change slug validation to require:

- non-empty explicit slugs match `/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u`;
- no slash, backslash, `..`, leading/trailing hyphen, or repeated hyphen;
- collision ownership is still decided by `sourceId`;
- an empty slug still derives from `slugifyTitle(title)`.

- [x] **Step 4: Remove failed image Markdown cleanly**

Replace the failed image with an empty string, then collapse excess blank lines outside fenced code. Keep the failure record in the report.

- [x] **Step 5: Run focused and full importer tests**

Run: `npx vitest run tests/importer/write-content.test.ts tests/importer/download-assets.test.ts`

Expected: PASS.

Run: `npx vitest run tests/importer`

Expected: PASS.

---

### Task 5: Execute the 18-Article Import

**Files:**
- Replace same-topic files under: `src/content/articles/`
- Create remaining article files under: `src/content/articles/`
- Create downloaded assets under: `public/images/articles/`
- Create: `outputs/local-import-report.json`

**Interfaces:**
- Consumes the completed local importer and the read-only source directory.
- Produces 18 imported topic files plus the existing Docker article.

- [x] **Step 1: Record the pre-import source state**

Run:

```powershell
Get-ChildItem -LiteralPath 'C:\ShawnL_Wiki\csdn' -File -Filter *.md |
  Get-FileHash -Algorithm SHA256 |
  ConvertTo-Json |
  Set-Content outputs/source-hashes-before.json
```

Expected: JSON containing 18 SHA-256 records.

- [x] **Step 2: Run the importer**

Run:

```powershell
npm run import:local -- --source-dir 'C:\ShawnL_Wiki\csdn' --max-retries 2
```

Expected: 18 discovered; every readable article is written; image failures, if any, are listed in `outputs/local-import-report.json`.

- [x] **Step 3: Verify the source directory stayed unchanged**

Run the same hash command to `outputs/source-hashes-after.json`, then:

```powershell
Compare-Object `
  (Get-Content -Raw outputs/source-hashes-before.json | ConvertFrom-Json) `
  (Get-Content -Raw outputs/source-hashes-after.json | ConvertFrom-Json) `
  -Property Path,Hash
```

Expected: no output.

- [x] **Step 4: Inspect the import report**

Run:

```powershell
Get-Content -Raw outputs/local-import-report.json
```

Expected: `discovered` is 18, `written` is 18, and article-level failures are empty. Failed assets may be present only when the corresponding remote image could not be downloaded and no remote URL remains in content.

- [ ] **Step 5: Inspect representative outputs**

Read:

- `src/content/articles/boost-在-windows-下编译.md`
- `src/content/articles/chromium-windows-编译-32-位正式版与定制配置.md`
- `src/content/articles/qt-qcamera-摄像头的简单使用.md`
- `src/content/articles/海康-led-显示屏网络协议对接.md`
- `src/content/articles/windows-批处理脚本中修复-node-gyp-环境变量.md`

Expected: valid frontmatter, coherent headings, fenced code, local image paths, and no platform residue.

---

### Task 6: Content Gates and Site Verification

**Files:**
- Modify: `tests/content/article-integrity.test.ts`
- Modify: `tests/site/no-csdn-links.test.ts`
- Create: `tests/content/article-assets.test.ts`
- Create: `docs/adding-articles.md`

**Interfaces:**
- Produces automated gates for article count, prohibited text, local image existence, and a maintenance guide for adding future Markdown.

- [ ] **Step 1: Tighten article integrity tests**

Require:

```ts
expect(files).toHaveLength(19);
expect(new Set(sourceIds).size).toBe(19);
expect(new Set(slugs).size).toBe(19);
```

Also assert every imported article filename matches its frontmatter slug plus `.md`.

- [ ] **Step 2: Expand the prohibited-content test**

Use:

```ts
const prohibited =
  /csdn\.net|blog\.csdn|csdnimg\.cn|\bCSDN\b|data:image\/gif|点击并拖拽以移动/iu;
```

Scan Markdown, MDX, HTML, and generated JSON reports only where report URLs are not intentionally retained. The final published content and `dist` must have zero violations.

- [ ] **Step 3: Add local image reference tests**

Extract Markdown image paths matching `/images/articles/...`, map each to `public`, and assert `access()` succeeds. Also reject HTTP image URLs from CSDN image hosts.

- [ ] **Step 4: Add the future article workflow guide**

Document this exact process in Chinese:

1. Put `<slug>.md` in `src/content/articles/`.
2. Add the seven required frontmatter fields and optional `updatedAt`.
3. Put images in `public/images/articles/<slug>/`.
4. Reference them as `![说明](/images/articles/<slug>/image.webp)`.
5. Run `npm test`, `npx tsc --noEmit -p tsconfig.json`, and `npm run build`.

Include a complete copy-ready Markdown example using the current schema.

- [ ] **Step 5: Run all automated tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 6: Run strict TypeScript checking**

Run: `npx tsc --noEmit -p tsconfig.json`

Expected: exit code 0.

- [ ] **Step 7: Build the production site**

Run: `npm run build`

Expected: Astro check succeeds and the site builds 19 article pages.

- [ ] **Step 8: Scan source and build output**

Run:

```powershell
rg -n -i "csdn\.net|blog\.csdn|csdnimg\.cn|\bCSDN\b|data:image/gif|点击并拖拽以移动" src/content/articles dist
```

Expected: no matches.

- [ ] **Step 9: Verify every referenced article image exists**

Run:

```powershell
npx vitest run tests/content/article-assets.test.ts
```

Expected: PASS.

- [ ] **Step 10: Preview representative pages**

Start the site with `npm run dev -- --host 127.0.0.1`, then inspect the homepage, article index, and at least the Boost, Qt camera, and Hikvision LED articles at desktop and mobile widths.

Expected: modern ink-wash styling remains intact; headings, code blocks, tables, and images do not overlap or overflow.

---

## Plan Self-Review

- Spec coverage: all 18 files, original-date fallback, read-only source handling, deduplication, CSDN cleanup, local images, per-article failures, final scanning, documentation, tests, type checking, build, and visual inspection are assigned to explicit tasks.
- Placeholder scan: the plan contains no `TBD`, deferred implementation, or unspecified error-handling steps.
- Type consistency: `LocalArticleMetadata`, `LocalImportOptions`, `sanitizeLocalMarkdown`, `importLocalArticles`, `ArticleDocument`, and `MigrationReport` names are consistent across producer and consumer tasks.
