export function normalizeBasePath(rawBasePath) {
  const value = String(rawBasePath ?? "").trim();
  if (value === "" || value === "/") {
    return "/";
  }

  const withoutOuterSlashes = value.replace(/^\/+|\/+$/g, "");
  return `/${withoutOuterSlashes}/`;
}

export function prefixBasePath(basePath, assetPath) {
  if (!assetPath.startsWith("/") || assetPath.startsWith("//")) {
    return assetPath;
  }
  return basePath === "/" ? assetPath : `${basePath}${assetPath.slice(1)}`;
}
