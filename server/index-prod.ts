import "dotenv/config";
import fs from "fs";
import path from "path";
import cors from "cors";
import express, { type Application } from "express";
import { createServer, type Server } from "node:http";

import { setupApp } from "./app.js";
import { getBotResponse } from "./services/responseManager.js";

// ---------------- ENV CHECK ----------------
if (!process.env.GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY is missing.");
  process.exit(1);
}
console.log("✅ GEMINI_API_KEY loaded");

// ---------------- GOOGLE SERVICE ACCOUNT ----------------
if (process.env.SERVICE_ACCOUNT_BASE64) {
  try {
    const json = Buffer.from(process.env.SERVICE_ACCOUNT_BASE64, "base64").toString("utf8");
    const keyPath = path.join(process.cwd(), "server/sa-key.json");
    fs.writeFileSync(keyPath, json);
    process.env.GOOGLE_APPLICATION_CREDENTIALS = keyPath;
    console.log("✅ Google service account key created:", keyPath);
  } catch (err) {
    console.error("❌ Failed to create Google service account key:", err);
    process.exit(1);
  }
}

// ---------------- VECTOR DB INIT ----------------
const dbDir = path.resolve(process.cwd(), "server/vector_store");
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log("✅ Vector DB folder created:", dbDir);
} else {
  console.log("✅ Vector DB folder exists:", dbDir);
}

// ---------------- PYTHON PATH (cross-platform auto-detect) ----------------
let pythonPath = "";
const venvDir = path.resolve(process.cwd(), ".venv");

if (process.platform === "win32") {
  const venvPython = path.join(venvDir, "Scripts", "python.exe");
  pythonPath = fs.existsSync(venvPython) ? venvPython : "python";
} else {
  const venvPython = path.join(venvDir, "bin", "python");
  pythonPath = fs.existsSync(venvPython) ? venvPython : "python3";
}

// Test if Python is available
const { spawnSync } = await import("node:child_process");
const pyTest = spawnSync(pythonPath, ["--version"]);
if (pyTest.error) {
  console.warn(`⚠️ Python not found or not executable (${pythonPath}). Embeddings will be disabled.`);
  pythonPath = "";
} else {
  console.log(`✅ Python detected: ${pyTest.stdout.toString().trim() || pyTest.stderr.toString().trim()}`);
}

// ---------------- START SERVER ----------------
(async () => {
  try {
    const app: Application = express();
    const httpServer: Server = createServer(app);

    app.use(cors({ origin: "*", credentials: true }));
    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ extended: true }));

    // Serve public folder
    const publicPath = path.resolve(process.cwd(), "public");
    if (fs.existsSync(publicPath)) {
      app.use(express.static(publicPath));
      console.log("✅ Public folder served:", publicPath);
    }

    // -------- CHAT ROUTE --------
    app.post("/chat", async (req, res) => {
      console.log("🔥 /chat route HIT");

      try {
        const { message, sessionId } = req.body;
        if (!message || !message.trim())
          return res.json({ answer: "Please provide a valid message." });

        const cleanMessage = message.trim();

        // Delegate to response manager
        const answer = await getBotResponse(cleanMessage, sessionId || "default", { pythonPath });
        return res.json({ answer });
      } catch (err) {
        console.error("❌ Chat route error:", err);
        return res.status(500).json({ answer: "Internal server error." });
      }
    });

    // Setup other routes
    await setupApp(app);

    const PORT = process.env.PORT || 10000;
    httpServer.listen(PORT, () => console.log(`🌐 Server running on port ${PORT}`));

    console.log("✅ Server bootstrap complete");
  } catch (err) {
    console.error("❌ Server bootstrap failed:", err);
    process.exit(1);
  }
})();
