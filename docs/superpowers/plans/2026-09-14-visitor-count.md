# Visitor Statistics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add public site-wide visitor and page-view counters to the static GitHub Pages site footer.

**Architecture:** Keep the site fully static and load the Busuanzi client asynchronously from the global Astro layout. Render stable counter elements in the footer with loading text, allowing the external script to fill in site-wide PV and UV values without adding a backend or build-time state.

**Tech Stack:** Astro 5, TypeScript, Vitest, CSS, Busuanzi browser script.

## Global Constraints

- The site must remain deployable as a static GitHub Pages artifact.
- The external statistics service must not block page rendering or navigation.
- The footer must display both total page views and unique visitors.
- Statistics failures must leave the article content and navigation usable.
- Do not add a server, database, secret, CSDN link, or remote article content.

---

### Task 1: Add the failing layout contract test

**Files:**
- Modify: `tests/site/layout.test.ts`
- Read: `src/layouts/BaseLayout.astro`

**Interfaces:**
- The test reads the global layout as text and verifies the public markup contract used by the external counter script.
- The implementation in Task 2 must provide the exact IDs `busuanzi_value_site_pv` and `busuanzi_value_site_uv`.

- [ ] **Step 1: Extend the test fixture paths**

Add the layout path beside the existing stylesheet path:

```ts
const layoutPath = path.resolve("src/layouts/BaseLayout.astro");
```

- [ ] **Step 2: Write the failing test**

Add this test to `tests/site/layout.test.ts`:

```ts
test("全局页脚包含异步访问统计和 PV/UV 计数节点", async () => {
  const layout = await readFile(layoutPath, "utf8");

  expect(layout).toMatch(
    /<script\s+async\s+src="https:\/\/busuanzi\.9420\.ltd\/js"><\/script>/,
  );
  expect(layout).toContain('id="busuanzi_value_site_pv"');
  expect(layout).toContain('id="busuanzi_value_site_uv"');
  expect(layout).toContain("本站访问量");
  expect(layout).toContain("累计访客");
});
```

- [ ] **Step 3: Run the focused test and verify it fails for the missing feature**

Run:

```powershell
npm test -- tests/site/layout.test.ts
```

Expected result before implementation: the existing layout test passes, and the new test fails because `BaseLayout.astro` does not yet contain the Busuanzi script or counter IDs.

---

### Task 2: Add the global counter markup and styling

**Files:**
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/styles/global.css`
- Test: `tests/site/layout.test.ts`

**Interfaces:**
- `BaseLayout.astro` produces the footer markup shared by every page.
- The external script fills `#busuanzi_value_site_pv` and `#busuanzi_value_site_uv`.
- `.site-footer__stats` is the stable styling hook for the statistics row.

- [ ] **Step 1: Add the footer counters**

Update the footer in `src/layouts/BaseLayout.astro` to:

```astro
<footer class="site-footer">
  <p>十六 · 软件工程师</p>
  <p class="site-footer__stats" aria-label="网站访问统计">
    <span id="busuanzi_container_site_pv">
      本站访问量：<span id="busuanzi_value_site_pv">统计加载中</span> 次
    </span>
    <span aria-hidden="true">·</span>
    <span id="busuanzi_container_site_uv">
      累计访客：<span id="busuanzi_value_site_uv">统计加载中</span> 人
    </span>
  </p>
</footer>
<script async src="https://busuanzi.9420.ltd/js"></script>
```

The script belongs after the page markup so it is non-blocking and is emitted once by the global layout.

- [ ] **Step 2: Add responsive footer statistics styling**

Append the following rule after `.site-footer p` in `src/styles/global.css`:

```css
.site-footer__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.65rem;
  margin-top: 0.4rem !important;
  font-size: 0.82rem;
  color: var(--mist);
}
```

This keeps the statistics visually subordinate to the site identity and allows natural wrapping on narrow screens.

- [ ] **Step 3: Run the focused test and verify it passes**

Run:

```powershell
npm test -- tests/site/layout.test.ts
```

Expected result: all layout tests pass, including the new script and counter contract.

---

### Task 3: Verify the full site and deploy

**Files:**
- Modify: none beyond Tasks 1-2
- Verify: all repository tests and production output

**Interfaces:**
- The existing `npm test` suite protects content, importer, layout, base-path, and CSDN-link constraints.
- `npm run build` runs Astro checks, static generation, and the post-build content gate.

- [ ] **Step 1: Run the full test suite**

Run:

```powershell
npm test
```

Expected result: 16 test files pass and all tests pass.

- [ ] **Step 2: Run the production build with GitHub Pages paths**

Run:

```powershell
$env:SITE_URL="https://z-smallrock.github.io/yy.github.io"
$env:BASE_PATH="/yy.github.io"
npm run build
```

Expected result: Astro reports 0 errors, 0 warnings, and 0 hints; static generation succeeds; the post-build content gate exits successfully.

- [ ] **Step 3: Inspect the diff**

Run:

```powershell
git diff --check
git status --short
```

Expected result: no whitespace errors and only the intended layout, stylesheet, and test changes are present.

- [ ] **Step 4: Commit the implementation**

Run:

```powershell
git add src/layouts/BaseLayout.astro src/styles/global.css tests/site/layout.test.ts
git commit -m "[feature] add visitor statistics"
```

- [ ] **Step 5: Push and verify the deployment trigger**

Run:

```powershell
git push origin main
```

Then verify the public site responds successfully and the footer contains the two labels:

```powershell
Invoke-WebRequest "https://z-smallrock.github.io/yy.github.io/" -UseBasicParsing
```

Expected result: GitHub Pages returns HTTP 200 after the Actions deployment completes, and the rendered footer eventually replaces `统计加载中` with the PV and UV values.
