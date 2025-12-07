// crawl-website-deep.js
import axios from "axios";
import { load } from "cheerio";
import Database from "better-sqlite3";
import { URL } from "url";

const DB = new Database("website_chunks.db");
DB.exec(`
  CREATE TABLE IF NOT EXISTS chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page_url TEXT,
    heading TEXT,
    content TEXT,
    chunk_index INTEGER
  )
`);

const baseUrl = "https://transition1.framer.website/"; // your site
const visited = new Set();
const toVisit = [baseUrl];
const maxPages = 29; // crawl up to 29 pages (you can increase)
const maxDepth = 4; // safety to avoid infinite recursion
const wordsPerChunk = 400; // ~300-500 tokens

function cleanText(t){
  return t.replace(/\s+/g,' ').trim();
}

async function crawl() {
  while (toVisit.length && visited.size < maxPages) {
    const url = toVisit.shift();
    if (!url || visited.has(url)) continue;
    try {
      const { data } = await axios.get(url, { timeout: 15000 });
      const $ = load(data);
      visited.add(url);

      // Extract meaningful content:
      const textParts = [];
      $("h1,h2,h3,p,li").each((i, el) => {
        const t = cleanText($(el).text());
        if (t && t.length > 20) textParts.push(t);
      });

      // Chunk into word-based chunks
      const words = textParts.join(" ").split(" ");
      let chunkIndex = 0;
      for (let i = 0; i < words.length; i += wordsPerChunk) {
        const chunk = words.slice(i, i + wordsPerChunk).join(" ");
        DB.prepare(`
          INSERT INTO chunks (page_url, heading, content, chunk_index)
          VALUES (?, ?, ?, ?)
        `).run(url, "", chunk, chunkIndex++);
      }

      console.log(`✅ Crawled (${visited.size}/${maxPages}): ${url}`);

      // enqueue internal links
      $("a[href]").each((_, el) => {
        const href = $(el).attr("href");
        if (!href) return;
        try {
          const absolute = new URL(href, baseUrl).href;
          // only same origin and not already visited or queued
          if (absolute.startsWith(baseUrl) && !visited.has(absolute) && !toVisit.includes(absolute)) {
            toVisit.push(absolute);
          }
        } catch (e) {}
      });
    } catch (err) {
      console.error(`❌ Failed to crawl ${url}: ${err.message}`);
    }
  }

  console.log(`🏁 Crawl finished. Pages crawled: ${visited.size}. Chunks in DB.`);
  DB.close();
}

crawl();
