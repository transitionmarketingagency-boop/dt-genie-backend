// server/chatbot.ts
import readline from "readline";
import { generateHybridResponse } from "./services/generateHybridResponse.js";
import { getTopChunks } from "./queryChunks.js";
import { getEmbedding } from "./embeddings.js";

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
      // Step 1: Embed input using real semantic embeddings
      const queryEmbedding: number[] = await getEmbedding(input);

      // Step 2: Retrieve top 3 relevant chunks from vector DB
      const chunks = await getTopChunks(queryEmbedding, 3);
      const context = chunks.map((c) => c.content).join("\n---\n");

      // Step 3: Send input + context to hybrid LLM
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
