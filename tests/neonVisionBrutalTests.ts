// tests/neonVisionBrutalTests.ts
import fs from "fs";
import path from "path";
import assert from "assert";
import { initializeMemory, memoryService } from "../server/services/memoryService";
import { executeHybridResponse } from "../server/services/generateHybridResponse";
import { cleanResponse } from "../server/utils/cleanResponse";

// ================== AUTO FOLDER CREATION ==================
const testsDir = path.resolve("./tests");
if (!fs.existsSync(testsDir)) fs.mkdirSync(testsDir, { recursive: true });

// ================== HELPER ==================
function randomString(len: number) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let str = "";
  for (let i = 0; i < len; i++) str += chars.charAt(Math.floor(Math.random() * chars.length));
  return str;
}

// ================== MAIN TEST ==================
async function runTests() {
  console.log("🚀 Starting Neon Vision Brutal Tests...");
  await initializeMemory();

  const sessionId = "test-session-" + Date.now();

  // ----- 1. Test memoryService.addMessage -----
  console.log("🧪 Testing memoryService.addMessage...");

  const msg1 = await memoryService.addMessage(sessionId, "user", "Hello there!");
  assert(msg1.content === "Hello there!", "Message content mismatch");
  console.log("✅ User message stored correctly");

  // Adjacent duplicate test
  const msg3 = await memoryService.addMessage(sessionId, "user", "Hello there!");
  assert.equal(msg3, null, "Adjacent duplicate message should be skipped");
  console.log("✅ Duplicate message skipped correctly");

  const msg2 = await memoryService.addMessage(sessionId, "assistant", "Hi! How can I help?");
  assert(msg2.role === "assistant", "Assistant role mismatch");
  console.log("✅ Assistant message stored correctly");

  // ----- 2. Test memoryService.getHistory -----
  console.log("🧪 Testing memoryService.getHistory...");
  const history = await memoryService.getHistory(sessionId);
  assert(history.length >= 2, "History length insufficient");
  console.log("✅ Full history retrieved:", history.length);

  // ----- 3. Test memoryService.getRecentContext -----
  console.log("🧪 Testing memoryService.getRecentContext...");
  const context = await memoryService.getRecentContext(sessionId);
  assert(context.length <= 5, "Context exceeded limit");
  console.log("✅ Recent context retrieved:", context.length);

  // ----- 4. Test strategic memory -----
  console.log("🧪 Testing strategic memory...");
  await memoryService.updateStrategicMemory(sessionId, {
    industry: "Marketing",
    businessType: "Agency",
    goals: ["Grow leads", "Increase revenue"],
    servicesDiscussed: ["SEO", "Ads"],
    leadScore: 8,
    stage: "Negotiation",
    budget: 5000,
    timeline: "3 months",
    decisionMaker: "John Doe",
    interestLevel: "High",
  });

  const strat = await memoryService.getStrategicMemory(sessionId);
  assert(strat.industry === "Marketing", "Industry mismatch");
  assert(strat.goals?.length === 2, "Goals not stored correctly");
  assert.equal(strat.budget, 5000, "Budget mismatch");
  console.log("✅ Strategic memory stored and retrieved correctly");

  // ----- 5. Test bookings -----
  console.log("🧪 Testing bookings...");
  await memoryService.storeBooking({
    userId: "user123",
    serviceType: "SEO",
    preferredTime: "2026-05-01 10:00",
    email: "test@example.com",
    status: "pending",
  });

  await memoryService.updateBookingStatus("user123", "confirmed");
  console.log("✅ Booking stored and status updated");

  // ----- 6. Test generateHybridResponse + cleaning -----
  console.log("🧪 Testing generateHybridResponse + cleanResponse...");
  const rawResponse = await executeHybridResponse({
    sessionId,
    message: "What is Digital Transition Marketing?",
    brainContext: { executionMode: "exploration" },
    leadScoreValue: 0,
    detectedIntentNames: [],
    vectorText: "",
    historyText: "",
    recentMessagesCache: [],
    intentCategories: [],
  });
  const cleaned = cleanResponse(rawResponse);
  assert(typeof cleaned === "string" && cleaned.length > 0, "Response cleaning failed");
  console.log("✅ Hybrid response generated and cleaned");

  console.log("🎯 All brutal tests passed!");
}

runTests().catch((err) => {
  console.error("❌ Tests failed:", err);
  process.exit(1);
});
