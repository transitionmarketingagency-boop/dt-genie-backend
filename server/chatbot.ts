// server/chatbot.ts

import readline from "readline";
import { generateHybridResponse } from "./services/generateHybridResponse.js";
import { memoryService } from "./services/memoryService.js";
import bookingFlow from "./bookingFlow.js";

/* ================= CLI SETUP ================= */

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log(" ~V Neon Vision CLI chatbot ready.");
console.log("Type a message or type 'exit' to quit.\n");

/* ================= SESSION MANAGEMENT ================= */

const SESSION_ID = "cli-session";

/* ================= BOOKING KEYWORDS ================= */

const BOOKING_KEYWORDS = [
  "book a call",
  "schedule a meeting",
  "schedule meeting",
  "schedule call",
  "book meeting",
  "book strategy session",
];

/* ================= SAFE HISTORY FETCH ================= */

async function getSafeHistory() {
  try {
    return await memoryService.getRecentContext(SESSION_ID);
  } catch {
    return [];
  }
}

/* ================= CHAT LOOP ================= */

async function ask(): Promise<void> {
  rl.question("You: ", async (input: string) => {

    const message = (input || "").trim();

    /* ---------- EXIT COMMANDS ---------- */

    const lower = message.toLowerCase();

    if (
      lower === "exit" ||
      lower === "quit" ||
      lower === "bye"
    ) {
      console.log("\n ~K Goodbye!\n");
      rl.close();
      process.exit(0);
    }

    /* ---------- IGNORE EMPTY ---------- */

    if (!message) {
      ask();
      return;
    }

    try {

      /* ================= SAVE USER MESSAGE ================= */

      await memoryService.saveMessage(
        SESSION_ID,
        "user",
        message
      );

      const lowerMsg = message.toLowerCase();

      /* ================= BOOKING DETECTION ================= */

      const isBookingKeyword = BOOKING_KEYWORDS.some((kw) =>
        lowerMsg.includes(kw)
      );

      const isBookingActive =
        bookingFlow.isBookingActive(SESSION_ID);

      if (isBookingKeyword || isBookingActive) {

        let bookingResponse;

        if (isBookingActive) {
          bookingResponse =
            await bookingFlow.handleStep(SESSION_ID, message);
        } else {
          bookingResponse =
            await bookingFlow.startBookingFlow(
              SESSION_ID,
              message
            );
        }

        console.log("\n ~V AI:", bookingResponse.response, "\n");

        /* CLI cannot execute frontend scripts */

        if (bookingResponse.frontendScript) {
          console.log("⚡ Calendly popup trigger received.");
        }

        ask();
        return;
      }

      /* ================= GENERATE HYBRID AI RESPONSE ================= */

      const response = await generateHybridResponse({
        message,
        sessionId: SESSION_ID,
        history: await getSafeHistory(),
      });

      console.log("\n ~V AI:", response, "\n");

    } catch (err) {

      console.error("⚠️ Error generating response:", err);

      console.log(
        "Sorry — something went wrong. Please try again.\n"
      );
    }

    ask();
  });
}

/* ================= START ================= */

ask();
