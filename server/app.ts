import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import router from "./routes.js";
import { queryGemini } from "./services/gemini.js";
import { memoryStore } from "./services/memory.js";

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.set("trust proxy", 1);
app.use(express.json({ limit: "10mb" }));

// Basic backend routes
app.use("/", router);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Gemini test
app.get("/test-gemini", async (req, res) => {
  try {
    const reply = await queryGemini("Say hello! This is a Gemini test.");
    res.json({ ok: true, reply });
  } catch (err) {
    console.error("Gemini test error:", err);
    res.status(500).json({ ok: false, error: "Gemini test failed" });
  }
});

const PORT = parseInt(process.env.PORT || "5000", 10);

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

