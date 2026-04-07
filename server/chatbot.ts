import readline from "readline";
import { executeHybridResponse } from "./services/generateHybridResponse.js"; // ✅ FIXED
import { memoryService } from "./services/memoryService.js";
import bookingFlow from "./bookingFlow.js";
import { shouldTriggerBooking } from "./services/bookingTrigger.js";

/* ================= CLI SETUP ================= */

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log(" ~V Neon Vision CLI chatbot ready.");
console.log("Type a message or type 'exit' to quit.\n");

/* ================= SESSION MANAGEMENT ================= */

const SESSION_ID = "cli-session";

/* ================= SAFE HISTORY FETCH ================= */

async function getSafeHistory() {
  try {
    const history = await memoryService.getRecentContext(SESSION_ID);
    return history ?? [];
  } catch {
    return [];
  }
}

/* ================= CHAT LOOP ================= */

async function ask(): Promise<void> {
  rl.question("You: ", async (input: string) => {
    const message = (input || "").trim();
    const lower = message.toLowerCase();

    /* ---------- EXIT COMMANDS ---------- */
    if (["exit", "quit", "bye"].includes(lower)) {
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
      /* ---------- SAVE USER MESSAGE ---------- */
      await memoryService.saveMessage(SESSION_ID, "user", message);

      /* ---------- SMART BOOKING DETECTION ---------- */
      const triggerBooking = await shouldTriggerBooking(SESSION_ID, "service");

      if (triggerBooking) {
        let bookingResponse;
        const isBookingActive = await bookingFlow.isBookingActive(SESSION_ID);

        if (isBookingActive) {
          bookingResponse = await bookingFlow.handleStep(SESSION_ID, message);
        } else {
          bookingResponse = await bookingFlow.startBookingFlow(SESSION_ID, message);
        }

        console.log("\n ~V AI:", bookingResponse.response, "\n");

        if (bookingResponse.frontendScript && bookingResponse.calendlyLink) {
          console.log("⚡ Safe booking link (open in browser):", bookingResponse.calendlyLink);
        }

        ask();
        return;
      }

      /* ---------- GENERATE HYBRID AI RESPONSE ---------- */
      const history = await getSafeHistory();

      const response = await executeHybridResponse({ // ✅ FIXED
        sessionId: SESSION_ID,
        message,
        brainContext: {},          // empty default context
        leadScoreValue: 0,         // default score
        detectedIntentNames: [],
        vectorText: "",
        historyText: history.map(h => h.content).join("\n") || "",
        recentMessagesCache: history,
        intentCategories: [],
      });

      /* ---------- SANITIZE CONTACT DETAILS ---------- */
      const safeResponse = response.replace(
        /((email|phone|address)[^:\n]*)/gi,
        "[contact info hidden for safety]"
      );

      console.log("\n ~V AI:", safeResponse, "\n");
    } catch (err) {
      console.error("⚠️ Error generating response:", err);
      console.log("Sorry — something went wrong. Please try again.\n");
    }

    ask();
  });
}

/* ================= START ================= */
ask();
