// server/populate-chunks.js
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const mdFolder = path.join("server/data/md");
const chunksFile = path.join("server/data/chunks.json");

// Create folders if missing
if (!fs.existsSync(mdFolder)) fs.mkdirSync(mdFolder, { recursive: true });
if (!fs.existsSync(path.dirname(chunksFile))) fs.mkdirSync(path.dirname(chunksFile), { recursive: true });

const chunkSize = 500; // words per chunk
const chunks = [];

const mdFiles = fs.readdirSync(mdFolder).filter(f => f.endsWith(".md"));
for (const file of mdFiles) {
    const content = fs.readFileSync(path.join(mdFolder, file), "utf8");
    const words = content.split(/\s+/);
    for (let i = 0; i < words.length; i += chunkSize) {
        const chunkText = words.slice(i, i + chunkSize).join(" ");

        // Call Python to get embedding
        const result = spawnSync("python", ["server/utils/embed_text.py", chunkText]);
        const embedding = JSON.parse(result.stdout.toString());

        chunks.push({ text: chunkText, embedding });
    }
}

// Save all chunks
fs.writeFileSync(chunksFile, JSON.stringify(chunks, null, 2));
console.log(`Done. Total chunks: ${chunks.length}`);
