import fs from "fs";
import path from "path";

const aiLogicFiles = [
  "server/ai_logic/faq/dtm_faqs_raw.json",
  "server/ai_logic/neon_vision/neon_vision_faq_bot.json",
  "server/ai_logic/neon_vision/neon_vision_intents.json",
  "server/ai_logic/neon_vision/neon_vision_pilot_onboarding.json",
  "server/ai_logic/neon_vision/neon_vision_sales_advisor.json",
  "server/ai_logic/neon_vision/neon_vision_technical_advisor.json",
  "server/ai_logic/phase_04/phase_04_faq_bot.json",
  "server/ai_logic/phase_04/phase_04_pilot_onboarding.json",
  "server/ai_logic/phase_04/phase_04_sales_advisor.json",
  "server/ai_logic/phase_04/phase_04_technical_advisor.json",
  "server/ai_logic/phase_05/personalization_logic.json",
  "server/ai_logic/phase_06/dynamic_response.json",
  "server/ai_logic/phase_07/dynamic_decision_tree.json",
];

console.log("🔍 Checking AI logic files...");

aiLogicFiles.forEach((filePath) => {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Missing file: ${filePath}`);
    return;
  }

  try {
    const data = fs.readFileSync(fullPath, "utf8");
    JSON.parse(data);
    console.log(`✅ Loaded: ${filePath}`);
  } catch (err) {
    console.error(`❌ Failed to parse JSON: ${filePath}`, err);
  }
});

console.log("🎯 AI logic check complete.");
