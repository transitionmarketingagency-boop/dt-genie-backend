// ------------------ LOAD ENV FIRST ------------------
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { execSync } from "node:child_process";

// ------------------ PATH SETUP ------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ------------------ ENV ------------------
dotenv.config();

// ------------------ SAFE DB INIT (RUNTIME ONLY) ------------------
try {
  const dbDir = path.resolve(__dirname, "../server/vector_store");

  // Ensure DB directory exists (Render-safe)
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Populate DB only if needed (non-production)
  if (process.env.NODE_ENV !== "production") {
    try {
      execSync("python server/utils/fill_chunks.py", {
        stdio: "inherit",
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.warn("⚠️ fill_chunks.py skipped or failed:", err.message);
      } else {
        console.warn("⚠️ fill_chunks.py skipped or failed:", err);
      }
    }
  }

  console.log("✅ SQLite chunks ready");
} catch (e: unknown) {
  if (e instanceof Error) {
    console.warn("⚠️ DB init skipped (already exists or non-fatal):", e.message);
  } else {
    console.warn("⚠️ DB init skipped (already exists or non-fatal):", e);
  }
}

// ------------------ REQUIRED ENV CHECK ------------------
if (!process.env.GEMINI_API_KEY) {
  console.error(
    "❌ GEMINI_API_KEY is missing. Check Render environment variables."
  );
  process.exit(1);
}

console.log("✅ GEMINI_API_KEY loaded");

// ------------------ IMPORTS FIXED ------------------
import express, { type Application } from "express";
import cors from "cors";

// Make sure ./app.js exists and exports default runApp
import runApp from "./app.js";

// Make sure ./services/hybridClient.js exports generateHybridResponse
import { generateHybridResponse } from "./services/hybridClient.js";

// ------------------ SERVER BOOTSTRAP ------------------
(async () => {
  try {
    await runApp(async (app: Application, server) => {
      // Enable CORS for Framer
      app.use(cors({ origin: "*", credentials: true }));
      app.use(express.json());

      // ------------------ STATIC FILES ------------------
      const publicPath = path.resolve(__dirname, "../public");
      if (fs.existsSync(publicPath)) {
        app.use(express.static(publicPath));
        console.log("✅ Public folder served:", publicPath);
      }

      // ------------------ CHAT ENDPOINT ------------------
      app.post("/chat", async (req, res) => {
        try {
          const { message } = req.body;

          if (!message || typeof message !== "string") {
            return res.status(400).json({ reply: "Message is required." });
          }

          console.log(" M-) Chat request:", message);

          // Generate professional hybrid response
          const reply = await generateHybridResponse(message);

          console.log(" M-$ Chat response sent");
          return res.json({ reply });
        } catch (err: unknown) {
          if (err instanceof Error) {
            console.error("❌ Chat Error:", err.message);
            console.error(err.stack);
          } else {
            console.error("❌ Chat Error:", err);
          }
          return res.status(500).json({ reply: "Internal server error" });
        }
      });

      const PORT = process.env.PORT || 5000;
      server.listen(PORT, () => {
        console.log(` ~@ Server running on port ${PORT}`);
      });
    });

    console.log("✅ Server bootstrap complete");
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error("❌ Server bootstrap failed:", err.message);
      console.error(err.stack);
    } else {
      console.error("❌ Server bootstrap failed:", err);
    }
    process.exit(1);
  }
})();
