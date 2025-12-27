import { generateWithOllama } from './services/ollamaClient.js';

async function test() {
  const response = await generateWithOllama(
    'gemma3:1b',
    'Say hello as DT-Genie in one sentence.'
  );

  console.log('\nOLLAMA RESPONSE:\n');
  console.log(response);
}

test().catch(console.error);
