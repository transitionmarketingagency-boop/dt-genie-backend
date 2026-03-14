// server/chatbot.ts

import readline from "readline";
import { generateHybridResponse } from "./services/generateHybridResponse.js";
import { strategicBrain } from "./services/strategicBrain.js";
import { memoryService } from "./services/memoryService.js";

/* ================= CLI SETUP ================= */
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log(" ~V Neon Vision CLI chatbot ready.");
console.log("Type a message or type 'exit' to quit.\n");

/* ================= SESSION MANAGEMENT ================= */
const SESSION_ID = "cli-session";

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
      console.log("\n ~K Goodbye!\n");
      rl.close();
      process.exit(0);
    }

    /* ---- Ignore empty input ---- */
    if (!message) {
      ask();
      return;
    }

    try {
      /* -------- Save user message to memory -------- */
      await memoryService.saveMessage(SESSION_ID, "user", message);

      /* -------- Strategic Brain Analysis -------- */
      const { brainContext } = await strategicBrain(message, SESSION_ID);

      console.log(
        `[Brain] Stage: ${brainContext.stage} | Intent: ${brainContext.intent} | LeadScore: ${brainContext.leadScore} | Reasoning: ${brainContext.reasoning}`
      );

      /* -------- Generate AI Response -------- */
      const response = await generateHybridResponse({
        message,
        sessionId: SESSION_ID,
        history: await memoryService.getRecentContext(SESSION_ID),
      });

      /* -------- Save assistant response to memory -------- */
      await memoryService.saveMessage(SESSION_ID, "assistant", response);

      console.log("\n ~V AI:", response, "\n");
    } catch (err) {
      console.error("⚠️ Error generating response:", err);
      console.log("Sorry — something went wrong.\n");
    }

    ask();
  });
}

/* ================= START ================= */
ask();
