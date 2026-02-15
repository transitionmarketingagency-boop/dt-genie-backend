import fs from 'fs';
import path from 'path';

const chunksPath = path.join('server', 'vector_store', 'chunks.json');
const queryText = process.argv[2];

if (!queryText) {
    console.log("Please provide a query text as the first argument");
    process.exit(1);
}

// Load all chunks
const chunks = JSON.parse(fs.readFileSync(chunksPath, 'utf-8'));

// Filter chunks that include the query in their text
const results = chunks
    .filter(c => c.text && c.text.toLowerCase().includes(queryText.toLowerCase()))
    .map(c => c.file);

// Deduplicate filenames
const uniqueResults = [...new Set(results)];

console.log("Top results:", uniqueResults);
