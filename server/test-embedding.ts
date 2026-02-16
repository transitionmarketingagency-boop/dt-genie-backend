import { embedText } from './services/embeddingClient.js';

async function testEmbedding() {
  const result = await embedText('Hello World');
  console.log('Embedding result:', result);
}

testEmbedding().catch(console.error);
