import fs from 'fs';
import path from 'path';

const chunksPath = path.join(process.cwd(), 'server', 'vector_store', 'chunks.json');

/**
 * Exported function for backend use
 */
export function getTopChunks(queryText, limit = 10) {
    if (!fs.existsSync(chunksPath)) {
        console.warn('chunks.json not found.');
        return [];
    }

    const chunks = JSON.parse(fs.readFileSync(chunksPath, 'utf-8'));

    // Defensive: ensure queryText is a string
    if (typeof queryText !== 'string') {
        console.warn('⚠️ getTopChunks called with non-string queryText:', queryText);
        queryText = String(queryText || '');
    }

    const queryLower = queryText.toLowerCase();

    const results = chunks
        .filter(c =>
            c.text && typeof c.text === 'string' && c.text.toLowerCase().includes(queryLower)
        )
        .slice(0, limit);

    return results;
}

/**
 * CLI mode support
 */
if (process.argv[1] && process.argv[1].includes('queryChunks.js')) {
    const queryText = process.argv[2];

    if (!queryText) {
        console.log("Please provide a query text as the first argument");
        process.exit(1);
    }

    const results = getTopChunks(queryText).map(c => c.file);
    const uniqueResults = [...new Set(results)];

    console.log("Top results:", uniqueResults);
}
