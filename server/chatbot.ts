import readline from "readline";
import { executeHybridResponse } from "./services/generateHybridResponse.js";
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

/* ================= SESSION ================= */

const SESSION_ID = "cli-session";

/* ================= HELPERS ================= */

async function getSafeHistory() {
  try {
    return (await memoryService.getRecentContext(SESSION_ID)) ?? [];
  } catch {
    return [];
  }
}

/* 🔥 CRITICAL: RESPONSE SANITIZER */
function sanitizeResponse(text: string): string {
  if (!text) return "";

  // remove dataset leaks
  if (
    text.includes('"intent"') ||
    text.includes('"examples"') ||
    text.includes('"response"') ||
    text.includes("FAQ [") ||
    text.includes("Source:")
  ) {
    return "Let me give you a clean, relevant answer based on your situation.\n\nCan you clarify your main goal right now?";
  }

  // remove fake system messages
  if (
    text.includes("system is now operational") ||
    text.includes("Next Steps Confirmation")
  ) {
    return text.replace(/system is now operational.*$/i, "").trim();
  }

  // remove contact hallucinations
  text = text.replace(
    /((email|phone|address)[^:\n]*)/gi,
    "[contact handled via booking]"
  );

  return text.trim();
}

/* ================= CHAT LOOP ================= */

async function ask(): Promise<void> {
  rl.question("You: ", async (input: string) => {
    const message = (input || "").trim();
    const lower = message.toLowerCase();

    if (["exit", "quit", "bye"].includes(lower)) {
      console.log("\n ~K Goodbye!\n");
      rl.close();
      process.exit(0);
    }

    if (!message) {
      ask();
      return;
    }

    try {
      /* ---------- SAVE USER MESSAGE ---------- */
      await memoryService.saveMessage(SESSION_ID, "user", message);

      /* ---------- GET MEMORY ---------- */
      const memory = await memoryService.getStrategicMemory(SESSION_ID);
      const history = await getSafeHistory();

      const leadScore = memory.leadScore ?? 0;
      const stage = (memory.stage as any) ?? "discovery";

      /* ---------- GENERATE RESPONSE FIRST (IMPORTANT) ---------- */
      let response = await executeHybridResponse({
        sessionId: SESSION_ID,
        message,
        brainContext: memory, // ✅ FIXED (was empty)
        leadScoreValue: leadScore,
        detectedIntentNames: memory.lastDetectedServices || [],
        vectorText: memory.lastUserProblem || "",
        historyText: history.map(h => h.content).join("\n") || "",
        recentMessagesCache: history,
        intentCategories: [],
      });

      response = sanitizeResponse(response);

      /* ---------- SAVE AI RESPONSE ---------- */
      await memoryService.saveMessage(SESSION_ID, "assistant", response);

      /* ---------- SMART BOOKING (AFTER RESPONSE) ---------- */
      const triggerBooking = await shouldTriggerBooking(
        SESSION_ID,
        stage,
        leadScore,
        message
      );

      if (triggerBooking) {
        const isBookingActive = await bookingFlow.isBookingActive(SESSION_ID);

        const bookingResponse = isBookingActive
          ? await bookingFlow.handleStep(SESSION_ID, message)
          : await bookingFlow.startBookingFlow(SESSION_ID, message);

        console.log("\n ~V AI:", response);
        console.log("\n📅", bookingResponse.response, "\n");

        if (bookingResponse.calendlyLink) {
          console.log("⚡ Booking link:", bookingResponse.calendlyLink);
        }

        ask();
        return;
      }

      /* ---------- NORMAL OUTPUT ---------- */
      console.log("\n ~V AI:", response, "\n");
    } catch (err) {
      console.error("⚠️ Error generating response:", err);
      console.log("Sorry — something went wrong. Please try again.\n");
    }

    ask();
  });
}

/* ================= START ================= */
ask();
