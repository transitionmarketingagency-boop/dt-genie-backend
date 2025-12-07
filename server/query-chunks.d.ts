// Tell TypeScript about the functions in query-chunks.js
export function fetchRelevantChunks(query: string, limit?: number): Promise<{ page_url: string; heading: string; content: string }[]>;
