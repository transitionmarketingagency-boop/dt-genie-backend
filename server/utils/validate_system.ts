// server/utils/validate_system.ts
import fs from "fs";
import path from "path";
import { getTopChunks } from "../queryChunks.js";
import { generateHybridResponse } from "../services/generateHybridResponse.js";
import { aiIntents } from "../services/json_loader.js";

const chunksPath = path.join(process.cwd(), "server", "vector_store", "chunks.json");
const reportPath = path.join(process.cwd(), "server", "validation_report.json");

async function validateSystem() {
  const report: Record<string, any> = { timestamp: new Date().toISOString() };

  // 1️⃣ Validate embedded chunks
  if (!fs.existsSync(chunksPath)) {
    report.chunks = { status: "missing", path: chunksPath };
    console.error("❌ Chunks file missing:", chunksPath);
  } else {
    const chunksData = JSON.parse(fs.readFileSync(chunksPath, "utf-8"));
    report.chunks = { status: "found", count: chunksData.length, path: chunksPath };
    console.log(`✅ Found ${chunksData.length} embedded chunks`);
  }

  // 2️⃣ Validate JSON AI intents
  report.aiIntents = { count: aiIntents.length };
  console.log(`✅ Loaded ${aiIntents.length} AI JSON intents`);

  // 3️⃣ Test getTopChunks
  try {
    const testQuery = "Show me CGI virtual property tours results";
    const topChunks = await getTopChunks(testQuery, 5, 0.15);
    report.topChunks = topChunks?.map((c: any) => c.text) || [];
    console.log("✅ getTopChunks returned", report.topChunks.length, "chunks");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("❌ getTopChunks failed:", message);
    report.topChunks = { error: message };
  }

  // 4️⃣ Test generateHybridResponse
  try {
    const testMessage = "Tell me about our services in real estate and CGI";
    const response = await generateHybridResponse(testMessage, "validation-session");
    report.hybridResponse = response;
    console.log("✅ generateHybridResponse succeeded");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("❌ generateHybridResponse failed:", message);
    report.hybridResponse = { error: message };
  }

  // 5️⃣ Write report
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");
  console.log(`✅ Validation report generated at ${reportPath}`);
}

validateSystem();
