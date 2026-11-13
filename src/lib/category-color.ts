/**
 * 分类色相：由分类名稳定映射到青绿—靛蓝区间，
 * 保证同一分类在服务端渲染与客户端过滤后颜色一致。
 */
export function categoryHue(category: string): number {
  let hash = 0;
  for (const character of category) {
    hash = (hash * 31 + (character.codePointAt(0) ?? 0)) % 997;
  }
  return 152 + (hash % 46);
}

export function categoryStyle(category: string): string {
  return `--cat-hue: ${categoryHue(category)}`;
}

export type CategoryTone = "acid" | "pink" | "blue";

const KNOWN_TONES: Record<string, CategoryTone> = {
  EDA: "acid",
  Electron: "pink",
  Qt: "blue",
  "C++": "acid",
  Chromium: "pink",
  Linux: "blue",
  "Node.js": "acid",
  Docker: "pink",
  硬件集成: "blue",
};

/** 粗野主义配色：同分类颜色稳定，未知分类按色相轮转。 */
export function categoryTone(category: string): CategoryTone {
  const known = KNOWN_TONES[category];
  if (known) return known;
  const tones: CategoryTone[] = ["acid", "pink", "blue"];
  return tones[categoryHue(category) % 3] ?? "acid";
}
