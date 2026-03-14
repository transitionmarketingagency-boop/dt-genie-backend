import readline from "readline";
import { generateHybridResponse } from "./services/generateHybridResponse.js";
import { strategicBrain } from "./services/strategicBrain.js";
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
      /* ================= SAVE USER MESSAGE ================= */
      await memoryService.saveMessage(SESSION_ID, "user", message);

      const lowerMsg = message.toLowerCase();

      /* ================= BOOKING FLOW DETECTION ================= */

      const isBookingKeyword = BOOKING_KEYWORDS.some((kw) =>
        lowerMsg.includes(kw)
      );

      const isBookingActive = bookingFlow.isBookingActive?.(SESSION_ID);

      if (isBookingKeyword || isBookingActive) {
        const bookingResponse = await bookingFlow.startBookingFlow(
          SESSION_ID,
          message
        );

        /* Save assistant response */
        await memoryService.saveMessage(
          SESSION_ID,
          "assistant",
          bookingResponse.response
        );

        console.log("\n ~V AI:", bookingResponse.response, "\n");

        /* CLI placeholder for frontend action */
        if (bookingResponse.frontendScript) {
          console.log("⚡ Calendly popup trigger received.");
        }

        ask();
        return;
      }

      /* ================= STRATEGIC BRAIN ================= */

      const { brainContext } = await strategicBrain(message, SESSION_ID);

      console.log(
        `[Brain] Stage: ${brainContext.stage} | Intent: ${brainContext.intent} | LeadScore: ${brainContext.leadScore} | Reasoning: ${brainContext.reasoning}`
      );

      /* ================= GENERATE AI RESPONSE ================= */

      const response = await generateHybridResponse({
        message,
        sessionId: SESSION_ID,
        history: await memoryService.getRecentContext(SESSION_ID),
      });

      /* ================= SAVE RESPONSE ================= */

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
