import { fetchRelevantChunks } from './query-chunks'; // <-- include .ts extension

(async () => {
  const queries = ['Digital Transformation', 'AI automation', 'Marketing strategy'];
  for (const q of queries) {
    const chunks = await fetchRelevantChunks(q, 5);
    console.log(q, '->', chunks.map(c => c.id));
  }
})();
