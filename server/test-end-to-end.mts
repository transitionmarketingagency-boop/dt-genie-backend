// 🚀 Full End-to-End Test for DT-Genie Hybrid System
// Compatible with Node 22 + ts-node + ESM
// Ensure all imports include file extensions (.js) for ESM

import { cosineSimilarity } from './utils/cosine.js';
import { generateHybridResponse } from './services/hybridRouter.js';
import { embedChunk } from './services/embeddingService.js'; // adjust export if needed
import fs from 'fs';
import path from 'path';

console.log('=== DT-Genie End-to-End Test Started ===\n');

// --------- Cosine Similarity Test ---------
console.log('--- Testing Cosine Similarity ---');

const vecA = [1, 2, 3];
const vecB = [4, 5, 6];

const cosSim = cosineSimilarity(vecA, vecB);
console.log(`Cosine similarity between [${vecA}] and [${vecB}] =`, cosSim, '\n');

// --------- Embedding Test ---------
console.log('--- Testing Embeddings ---');

async function testEmbeddings() {
  try {
    const sampleText = 'Digital Transition Marketing helps businesses grow using AI.';
    const embedding = await embedChunk(sampleText);
    console.log('Sample embedding length:', embedding.length, '\n');
  } catch (err) {
    console.error('Embedding test failed:', err);
  }
}

// --------- Hybrid AI System Test ---------
console.log('--- Testing Hybrid AI System (Gemma + Gemini) ---');

async function testHybridSystem() {
  try {
    const simplePrompt = 'What services does Digital Transition Marketing offer?';
    const complexPrompt = 'Create a full marketing automation strategy with funnels, CRM, and AI';

    const simpleResponse = await generateHybridResponse(simplePrompt);
    console.log('SIMPLE query response:\n', simpleResponse, '\n');

    const complexResponse = await generateHybridResponse(complexPrompt);
    console.log('[Hybrid] COMPLEX query response:\n', complexResponse, '\n');
  } catch (err) {
    console.error('Hybrid system test failed:', err);
  }
}

// --------- Run All Tests ---------
async function runAllTests() {
  await testEmbeddings();
  await testHybridSystem();
  console.log('=== All Tests Completed ===');
}

runAllTests();
