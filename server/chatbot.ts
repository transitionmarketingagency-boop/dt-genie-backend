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

// ---------------- Simple intent detector (FAST PATH) ----------------
function isSimpleIntent(text: string) {
  const t = text.toLowerCase().trim();
  return (
    t === "hi" ||
    t === "hello" ||
    t === "hey" ||
    t === "are you there" ||
    t === "who are you" ||
    t.includes("your services") ||
    t.includes("what services") ||
    t.includes("tell me about")
  );
}

// ---------------- Ask loop ----------------
async function ask() {
  rl.question("You: ", async (input) => {
    if (input.toLowerCase() === "exit") {
      console.log("\n ~K Goodbye!");
      rl.close();
      process.exit(0);
    }

    try {
      // 🔹 FAST PATH — simple intents bypass embeddings
      if (isSimpleIntent(input)) {
        const response = await generateHybridResponse(input, "default-session");
        console.log("\n🤖 AI Response:", response, "\n");
        return ask();
      }

      // Step 1: Embed input
      const queryEmbedding: number[] = await getEmbedding(input);

      // Step 2: Retrieve top relevant KB chunks
      const chunks = await getTopChunks(queryEmbedding, 5);

      // Step 3: Prepare context dynamically
      const context =
        chunks.length > 0
          ? chunks.map((c) => c.content).join("\n---\n")
          : "You are DT-Genie, the AI assistant for Digital Transition Marketing. Answer clearly and confidently.";

      // Step 4: Hybrid response with dynamic context
      const response = await generateHybridResponse(input, "default-session");

      console.log("\n🤖 AI Response:", response, "\n");
    } catch (err) {
      console.error("⚠️ Error generating response:", err);
      console.log(
        "I'm sorry — something went wrong while processing your request.\n"
      );
    }

    ask();
  });
}

ask();
