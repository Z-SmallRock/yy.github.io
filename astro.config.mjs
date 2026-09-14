import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import { normalizeBasePath, prefixBasePath } from "./site-path.mjs";

const basePath = normalizeBasePath(process.env.BASE_PATH);

function prefixPublicImageUrls() {
  return function transform(tree) {
    const visit = (node) => {
      if (
        node.type === "image" &&
        typeof node.url === "string" &&
        node.url.startsWith("/images/")
      ) {
        node.url = prefixBasePath(basePath, node.url);
      }
      for (const child of node.children ?? []) {
        visit(child);
      }
    };
    visit(tree);
  };
}

export default defineConfig({
  integrations: [mdx()],
  markdown: {
    remarkPlugins: [prefixPublicImageUrls],
  },
  site: process.env.SITE_URL || undefined,
  // 支持 GitHub Pages 通过环境变量注入仓库子路径。
  base: basePath,
});
