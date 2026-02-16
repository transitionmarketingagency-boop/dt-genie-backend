import { generateGemini } from './services/geminiClient.js';

async function listModels() {
  const response = await generateGemini('List models');
  console.log('Gemini response:', response);
}

listModels().catch(console.error);
