// server/queryChunks.js

import fs from "fs";
import path from "path";

const chunksPath = path.join(process.cwd(), "server", "vector_store", "chunks.json");

// Lightweight stopword list
const STOPWORDS = new Set([
  "the","is","are","a","an","and","or","of","to","in",
  "for","on","with","by","at","from","as","that","this",
  "it","be","was","were","will","can","could","should"
]);

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOPWORDS.has(word));
}

function scoreChunk(queryTokens, chunkText) {
  const chunkTokens = tokenize(chunkText);
  const tokenSet = new Set(chunkTokens);

  let score = 0;

  for (const token of queryTokens) {
    if (tokenSet.has(token)) score += 3;

    for (const ct of chunkTokens) {
      if (ct.includes(token) || token.includes(ct)) score += 1;
    }
  }

  for (const token of queryTokens) {
    const frequency = chunkTokens.filter(t => t === token).length;
    score += frequency;
  }

  return score;
}

export function getTopChunks(queryText, limit = 6) {
  if (!fs.existsSync(chunksPath)) {
    console.warn("chunks.json not found.");
    return [];
  }

  let chunks = [];
  try {
    chunks = JSON.parse(fs.readFileSync(chunksPath, "utf-8"));
  } catch (err) {
    console.error("Invalid chunks.json format:", err);
    return [];
  }

  if (typeof queryText !== "string") queryText = String(queryText || "");

  const queryTokens = tokenize(queryText);
  if (queryTokens.length === 0) return [];

  const scored = [];

  for (const chunk of chunks) {
    if (!chunk?.text || typeof chunk.text !== "string") continue;

    const score = scoreChunk(queryTokens, chunk.text);
    if (score > 0) scored.push({ ...chunk, score });
  }

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit);
}

/* ---------- CLI Mode ---------- */
if (process.argv[1] && process.argv[1].includes("queryChunks.js")) {
  const queryText = process.argv[2];
  if (!queryText) {
    console.log("Please provide a query text as the first argument");
    process.exit(1);
  }

  const results = getTopChunks(queryText).map(c => ({
    file: c.file,
    score: c.score
  }));

  console.log("Top results:", results);
}
