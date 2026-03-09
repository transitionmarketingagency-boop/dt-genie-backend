// server/chatbot.ts

import readline from "readline";
import { generateHybridResponse } from "./services/generateHybridResponse.js";

/* ================= CLI SETUP ================= */

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("🤖 Neon Vision CLI chatbot ready.");
console.log("Type a message or type 'exit' to quit.\n");

/* ================= CHAT LOOP ================= */

async function ask(): Promise<void> {
  rl.question("You: ", async (input: string) => {

    const message = input.trim();

    /* ---- Exit commands ---- */

    if (
      message.toLowerCase() === "exit" ||
      message.toLowerCase() === "quit" ||
      message.toLowerCase() === "bye"
    ) {
      console.log("\n👋 Goodbye!\n");
      rl.close();
      process.exit(0);
    }

    /* ---- Ignore empty input ---- */

    if (!message) {
      ask();
      return;
    }

    try {

      const response = await generateHybridResponse({
        message,
        sessionId: "cli-session",
      });

      console.log("\n🤖 AI:", response, "\n");

    } catch (err) {

      console.error("⚠️ Error generating response:", err);
      console.log("Sorry — something went wrong.\n");

    }

    ask();
  });
}

/* ================= START ================= */

ask();
