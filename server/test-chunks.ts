import { fetchRelevantChunks } from './query-chunks.js';

async function testChunks() {
  const chunks = await fetchRelevantChunks('Test query');
  console.log('Relevant chunks:', chunks);
}

testChunks().catch(console.error);
