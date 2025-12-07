import { load } from "cheerio";
import axios from "axios";
import Database from "better-sqlite3";

// Example: create DB
const db = new Database("website_chunks.db");
db.exec(`
  CREATE TABLE IF NOT EXISTS chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT,
    content TEXT
  )
`);

// Target website
const TARGET_URL = "https://transition1.framer.website/";

// Fetch and parse
async function crawl(url) {
  console.log("🌐 Starting crawl of", url);
  const response = await axios.get(url);
  const $ = load(response.data);

  const textContent = $("body").text().replace(/\s+/g, " ").trim();

  const stmt = db.prepare("INSERT INTO chunks (url, content) VALUES (?, ?)");
  stmt.run(url, textContent);

  console.log("✅ Saved content from", url);
}

crawl(TARGET_URL)
  .then(() => {
    console.log("🏁 Crawl completed. Data saved to website_chunks.db");
    db.close();
  })
  .catch((err) => {
    console.error("❌ Crawl failed:", err);
    db.close();
  });
