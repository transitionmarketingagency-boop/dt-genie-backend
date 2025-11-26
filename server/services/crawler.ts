import axios from "axios";
import * as cheerio from "cheerio";

interface CrawlResult {
  url: string;
  title: string;
  text: string;
  error?: string;
}

const visited = new Set<string>();

function isValidUrl(url: string, baseUrl: string): boolean {
  try {
    const parsed = new URL(url, baseUrl);
    const base = new URL(baseUrl);
    return parsed.hostname === base.hostname && parsed.protocol.startsWith("http");
  } catch {
    return false;
  }
}

export async function crawlSinglePage(url: string): Promise<CrawlResult> {
  if (visited.has(url)) {
    return { url, title: "", text: "", error: "Already visited" };
  }

  visited.add(url);

  try {
    const response = await axios.get(url, {
      timeout: 5000,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AIBot/1.0)",
      },
    });

    const $ = cheerio.load(response.data);

    // Remove script and style elements
    $("script, style, nav, footer").remove();

    const title = $("title").text() || $("h1").first().text() || url;
    const text = $("body").text();

    // Clean up whitespace
    const cleanText = text
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join(" ")
      .replace(/\s+/g, " ");

    return {
      url,
      title,
      text: cleanText.substring(0, 10000), // Limit to 10k chars
    };
  } catch (error) {
    return {
      url,
      title: "",
      text: "",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function crawlWebsite(
  startUrl: string,
  maxDepth: number = 2,
  maxPages: number = 10
): Promise<CrawlResult[]> {
  visited.clear();
  const results: CrawlResult[] = [];
  const queue: { url: string; depth: number }[] = [{ url: startUrl, depth: 0 }];

  while (queue.length > 0 && results.length < maxPages) {
    const { url, depth } = queue.shift()!;

    if (depth > maxDepth || results.length >= maxPages) continue;

    const result = await crawlSinglePage(url);
    results.push(result);

    // Extract links from successful crawls
    if (!result.error) {
      try {
        const response = await axios.get(url, {
          timeout: 5000,
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; AIBot/1.0)",
          },
        });

        const $ = cheerio.load(response.data);
        const links = new Set<string>();

        $("a[href]").each((_i, elem) => {
          const href = $(elem).attr("href");
          if (href && isValidUrl(href, url) && !visited.has(href)) {
            links.add(href);
          }
        });

        for (const link of links) {
          if (results.length < maxPages) {
            queue.push({ url: link, depth: depth + 1 });
          }
        }
      } catch {
        // Silently skip link extraction errors
      }
    }

    // Avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return results;
}
