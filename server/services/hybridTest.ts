// server/services/hybridTest.ts

import fs from 'fs';
import path, { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateHybridResponse } from './generateHybridResponse.js';
import { fetchRelevantChunks } from '../queryChunksWrapper.js';
import { memoryService } from './memoryService.js';

// ES Module fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Paths
const memoryDir = resolve(__dirname, '../memory');
const logFile = resolve(memoryDir, 'testResults.log');

// Ensure memory folder exists
if (!fs.existsSync(memoryDir)) fs.mkdirSync(memoryDir, { recursive: true });
// Ensure log file exists
if (!fs.existsSync(logFile)) fs.writeFileSync(logFile, '', 'utf-8');

// Async logging helper
async function log(message: string) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    await fs.promises.appendFile(logFile, logMessage, 'utf-8');
    console.log(logMessage);
}

// Test queries
const testQueries = [
    "How can I improve my marketing campaigns?",
    "Tell me about pricing for your services.",
    "I need help with the platform, it’s not working.",
    "What AI tools do you recommend for small businesses?",
    "Give me a summary of the website content."
];

// Test user ID
const testUserId = 'test_user_01';

async function runTests() {
    await log("=== Hybrid AI System Test Started ===");

    for (const query of testQueries) {
        try {
            await log(`\n--- Running Test Query: "${query}" ---`);

            // Fetch top 5 relevant chunks
            const chunks = await fetchRelevantChunks(query, 5);
            await log(`Top Chunks Retrieved:\n${JSON.stringify(chunks, null, 2)}`);

            // Generate hybrid response
            const response = await generateHybridResponse(query, testUserId);
            await log(`Hybrid Response:\n${response}`);

            // Log latest memory updates using memoryService
            const sessionMemory = await memoryService.getHistory(testUserId);
            const userMemory = await memoryService.getHistory(testUserId);
            await log(`Session Memory Updated (last entry):\n${JSON.stringify(sessionMemory.slice(-1), null, 2)}`);
            await log(`User Memory Updated (last entry):\n${JSON.stringify(userMemory.slice(-1), null, 2)}`);
        } catch (err) {
            await log(`Error processing query "${query}": ${err}`);
        }
    }

    await log("=== All Hybrid AI Tests Completed ===\n");
}

// Run tests
runTests().catch(err => log(`Error during test execution: ${err}`));
