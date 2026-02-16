import { generateWithOllama } from './services/ollamaClient.js';

async function testOllama() {
  const response = await generateWithOllama('Hello Ollama');
  console.log('Ollama response:', response);
}

testOllama().catch(console.error);
