// server/chatbot.ts
import readline from "readline";
import { generateHybridResponse } from "./services/hybridClient";
import { getTopChunks } from "./queryChunks";

// Simple character-based embedding for user input
function embedText(text: string): number[] {
  return Array.from(text).map((c) => c.charCodeAt(0) / 255);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log(" ~V DT-Genie is ready. Type your message below.\n");

async function ask() {
  rl.question("You: ", async (input) => {
    if (input.toLowerCase() === "exit") {
      console.log("\n ~K Goodbye!");
      rl.close();
      process.exit(0);
    }

    try {
      // Step 1: Embed input and get top chunks from DB
      const queryEmbedding = embedText(input);
      const chunks = await getTopChunks(queryEmbedding, 3);
      const context = chunks.map((c) => c.content).join("\n---\n");

      // Step 2: Send input + context to hybrid LLM
      const response = await generateHybridResponse(input, context);

      console.log("\n M-, AI Response:", response, "\n");
    } catch (err) {
      console.error("⚠️ Error generating response:", err);
      console.log("I'm sorry, something went wrong while processing your request.\n");
    }

    ask();
  });
}

ask();
