import axios from "axios";

const SEARXNG_URL = process.env.SEARXNG_URL || "https://searx.be";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedDate: string | null;
}

export async function searchWeb(query: string, maxResults = 8): Promise<SearchResult[]> {
  try {
    const { data } = await axios.get(`${SEARXNG_URL}/search`, {
      params: {
        q: query,
        format: "json",
        language: "zh-CN",
        time_range: "week",
        categories: "news,general",
      },
      timeout: 30000,
    });

    const results: SearchResult[] = (data.results || [])
      .filter((r: any) => r.url && r.title)
      .slice(0, maxResults)
      .map((r: any) => ({
        title: r.title,
        url: r.url,
        snippet: r.content || "",
        publishedDate: r.publishedDate || null,
      }));

    return results;
  } catch (err: any) {
    console.error(`[search] Error searching "${query}":`, err.message);
    return [];
  }
}

export function formatSearchResults(results: SearchResult[]): string {
  if (results.length === 0) {
    return "No search results found.";
  }
  return results
    .map(
      (r, i) =>
        `${i + 1}. **${r.title}**\n   URL: ${r.url}\n   ${r.publishedDate ? `Date: ${r.publishedDate}\n   ` : ""}Summary: ${r.snippet}`,
    )
    .join("\n\n");
}
