import { fetchRelevantChunks } from "../training_pipeline/utils/query-chunks";
import { gemmaClient } from "./gemmaClient";
import { geminiClient } from "./geminiClient";
import { memoryClient } from "./memoryClient";
import fs from "fs";
import path from "path";

// Load system persona
const personaPath = path.join(__dirname, "../knowledge_base/persona/system_persona.json");
const systemPersona = JSON.parse(fs.readFileSync(personaPath, "utf-8"));

// Function to detect role (sales/marketing/support)
function detectUserRole(userMessage: string): string {
    const msg = userMessage.toLowerCase();
    if (msg.includes("buy") || msg.includes("pricing") || msg.includes("client")) return "sales";
    if (msg.includes("ad") || msg.includes("campaign") || msg.includes("marketing")) return "marketing";
    if (msg.includes("help") || msg.includes("issue") || msg.includes("support")) return "support";
    return "general";
}

// Compose full deep context
async function buildDeepContext(userId: string, userMessage: string) {
    // Fetch top 5 relevant chunks
    const relevantChunks = await fetchRelevantChunks(userMessage, 5);

    // Retrieve memories
    const sessionMemory = memoryClient.getSessionMemory(userId);
    const userMemory = memoryClient.getUserMemory(userId);

    // Detect role
    const role = detectUserRole(userMessage);

    // Build context string
    const context = `
System Persona: ${JSON.stringify(systemPersona)}
Role: ${role}
Session Memory: ${JSON.stringify(sessionMemory)}
User Memory: ${JSON.stringify(userMemory)}
Top Relevant Chunks: ${JSON.stringify(relevantChunks)}
User Message: ${userMessage}
`;
    return context;
}

// Main hybrid response function
export async function generateHybridResponse(userId: string, userMessage: string) {
    try {
        const context = await buildDeepContext(userId, userMessage);

        // First try Gemma (local AI)
        let response = await gemmaClient.generateResponse(context);

        // Fallback to Gemini (cloud AI) if Gemma fails or low confidence
        if (!response || response.trim().length === 0) {
            response = await geminiClient.generateResponse(context);
        }

        // Append to memories
        memoryClient.appendSessionMemory(userId, { user: userMessage, bot: response });
        memoryClient.appendUserMemory(userId, { user: userMessage, bot: response });

        return response;
    } catch (error) {
        console.error("Hybrid response error:", error);
        return "Sorry, I encountered an error while generating a response.";
    }
}
