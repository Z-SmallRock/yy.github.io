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
