import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type {
  Definition,
  Image,
  ImageReference as MarkdownImageReference,
  Nodes,
  Root,
} from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";

const prohibited =
  /csdn\.net|blog\.csdn|csdnimg\.cn|\bCSDN\b|data:image\/gif|点击并拖拽以移动/iu;
const publishedFile = /\.(md|mdx|html|json)$/i;
const articleFile = /\.(md|mdx)$/i;
const articleImagePrefix = "/images/articles/";
const csdnImageHost = /(?:^|\.)(?:csdnimg\.cn|csdn\.net)$/iu;
const localBaseUrl = new URL("https://local.invalid");

interface ImageReference {
  file: string;
  line: number;
  target: string;
}

async function listFiles(
  root: string,
  pattern: RegExp,
): Promise<string[]> {
  const files: string[] = [];

  async function visit(current: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return;
      }
      throw error;
    }

    for (const entry of entries) {
      const filePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await visit(filePath);
      } else if (pattern.test(entry.name)) {
        files.push(filePath);
      }
    }
  }

  await visit(root);
  return files.sort();
}

function normalizeIdentifier(identifier: string): string {
  return identifier.trim().replace(/\s+/gu, " ").toLowerCase();
}

function walk(node: Nodes, visitor: (node: Nodes) => void): void {
  visitor(node);
  if ("children" in node) {
    for (const child of node.children) {
      walk(child, visitor);
    }
  }
}

function collectMarkdownImageReferences(
  source: string,
  file: string,
): ImageReference[] {
  const tree: Root = fromMarkdown(source);
  const definitions = new Map<string, Definition>();
  const images: Array<Image | MarkdownImageReference> = [];

  walk(tree, (node) => {
    if (node.type === "definition") {
      definitions.set(normalizeIdentifier(node.identifier), node);
    } else if (node.type === "image" || node.type === "imageReference") {
      images.push(node);
    }
  });

  return images.flatMap((image) => {
    const target =
      image.type === "image"
        ? image.url
        : definitions.get(normalizeIdentifier(image.identifier))?.url;
    if (!target) {
      return [];
    }
    return [
      {
        file,
        line: image.position?.start.line ?? 1,
        target,
      },
    ];
  });
}

function formatReference(reference: ImageReference): string {
  return `${path.relative(process.cwd(), reference.file)}:${reference.line}`;
}

function isPathInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function resolveArticleAssetPath(
  target: string,
  publicDir: string,
): { assetPath?: string; error?: string } | null {
  let targetUrl: URL;
  try {
    targetUrl = new URL(target, localBaseUrl);
  } catch {
    return { error: "图片 URL 无效" };
  }
  if (targetUrl.origin !== localBaseUrl.origin) {
    if (targetUrl.protocol === "http:" || targetUrl.protocol === "https:") {
      return null;
    }
    if (
      targetUrl.protocol === "file:" ||
      /^[a-z]:[\\/]/iu.test(target)
    ) {
      return { error: "不允许使用本地文件 URL 或绝对文件路径" };
    }
    return { error: `不支持的图片 URL 协议: ${targetUrl.protocol}` };
  }

  let pathname: string;
  try {
    const pathEnd = target.search(/[?#]/u);
    const rawPathname = pathEnd === -1 ? target : target.slice(0, pathEnd);
    pathname = decodeURIComponent(rawPathname);
  } catch {
    return { error: "图片路径包含无效的 URL 编码" };
  }

  const normalizedPathname = pathname.replace(/[\\/]+/gu, "/");
  if (!normalizedPathname.startsWith(articleImagePrefix)) {
    return { error: "图片路径解码后越出 public/images/articles" };
  }

  const relativePath = normalizedPathname
    .slice(1)
    .split("/")
    .join(path.sep);
  const articleAssetsDir = path.resolve(publicDir, "images", "articles");
  const assetPath = path.resolve(publicDir, relativePath);
  if (!isPathInside(articleAssetsDir, assetPath)) {
    return { error: "图片路径解码后越出 public/images/articles" };
  }

  return { assetPath };
}

export async function findProhibitedPublishedContent(
  roots: readonly string[],
): Promise<string[]> {
  const files = (
    await Promise.all(
      roots.map((root) => listFiles(path.resolve(root), publishedFile)),
    )
  ).flat();
  const violations: string[] = [];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    source.split(/\r?\n/u).forEach((line, index) => {
      if (prohibited.test(line)) {
        violations.push(
          `${path.relative(process.cwd(), file)}:${index + 1}: ${line.trim()}`,
        );
      }
    });
  }

  return violations;
}

export async function findArticleAssetViolations(
  contentDir: string,
  publicDir: string,
): Promise<string[]> {
  const files = await listFiles(path.resolve(contentDir), articleFile);
  const violations: string[] = [];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    const references = collectMarkdownImageReferences(source, file);

    for (const reference of references) {
      const localAsset = resolveArticleAssetPath(
        reference.target,
        path.resolve(publicDir),
      );
      if (localAsset?.error) {
        violations.push(
          `${formatReference(reference)}: ${localAsset.error}: ${reference.target}`,
        );
        continue;
      }
      if (localAsset?.assetPath) {
        try {
          const metadata = await stat(localAsset.assetPath);
          if (!metadata.isFile()) {
            throw new Error("not a file");
          }
        } catch {
          violations.push(
            `${formatReference(reference)}: 图片文件不存在: ${reference.target}`,
          );
        }
        continue;
      }

      try {
        const imageUrl = new URL(reference.target, localBaseUrl);
        if (
          (imageUrl.protocol === "http:" || imageUrl.protocol === "https:") &&
          csdnImageHost.test(imageUrl.hostname)
        ) {
          violations.push(
            `${formatReference(reference)}: 不允许引用 CSDN 远程图片: ${reference.target}`,
          );
        }
      } catch {
        violations.push(
          `${formatReference(reference)}: 图片 URL 无效: ${reference.target}`,
        );
      }
    }
  }

  return violations;
}

export async function runContentGate(rootDir = process.cwd()): Promise<void> {
  const contentDir = path.resolve(rootDir, "src", "content", "articles");
  const publicDir = path.resolve(rootDir, "public");
  const distDir = path.resolve(rootDir, "dist");
  const violations = [
    ...(await findProhibitedPublishedContent([contentDir, distDir])),
    ...(await findArticleAssetViolations(contentDir, publicDir)),
  ];

  if (violations.length > 0) {
    throw new Error(
      `发布内容门禁失败，共 ${violations.length} 项：\n${violations.join("\n")}`,
    );
  }
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : "";
if (import.meta.url === invokedPath) {
  runContentGate().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
