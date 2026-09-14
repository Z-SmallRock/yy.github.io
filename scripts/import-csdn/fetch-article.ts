import { fetchHtml } from "./discover";
import type { HttpOptions, RawArticle } from "./types";

function extractTitle(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch?.[1]) {
    return titleMatch[1].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  }

  const headingMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return headingMatch?.[1]
    ? headingMatch[1].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
    : "";
}

export async function fetchArticle(
  url: string,
  options: HttpOptions = {},
): Promise<RawArticle> {
  const fetched = await fetchHtml(url, options);

  return {
    url: fetched.url,
    html: fetched.html,
    title: extractTitle(fetched.html),
    contentHtml: fetched.html,
  };
}
