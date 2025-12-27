import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Application } from "express";
import type { Server } from "node:http";

import runApp from "./app.js";
import { setupApp } from "./app.js";
import { getTopChunks } from "./queryChunks.js";
import { generateHybridResponse } from "./services/hybridClient.js";
import populateTestData from "./populate-test-data.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ------------------ STATIC FILE HANDLER ------------------
export function serveStatic(app: Application, _server: Server) {
  const distPublicPath = path.resolve(__dirname, "../dist/public");
  const publicPath = path.resolve(__dirname, "../public");

  if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
    console.log("✅ Public folder served");
  }

  if (fs.existsSync(distPublicPath)) {
    app.use(express.static(distPublicPath));
    console.log("✅ Dist folder served");
  }

  app.get("*", (req, res, next) => {
    const indexPath = path.join(distPublicPath, "index.html");
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
    next();
  });
}

// ------------------ SERVER BOOTSTRAP ------------------
(async () => {
  await runApp(async (app: Application, server: Server) => {
    await setupApp(app);

    // 🔥 MAIN CHAT ENDPOINT — THIS WAS MISSING
    app.post("/chat", async (req, res) => {
      try {
        const { message } = req.body;

        if (!message) {
          return res.status(400).json({ reply: "Message is required." });
        }

        // 1️⃣ Create embedding
        const embedding = Array.from(message).map((c) => c.charCodeAt(0) / 255);

        // 2️⃣ Fetch relevant knowledge
        const chunks = await getTopChunks(embedding, 5);
        const context = chunks.map(c => c.content).join("\n---\n");

        // 3️⃣ Generate final response
        const reply = await generateHybridResponse(message, context);

        res.json({ reply });
      } catch (err) {
        console.error("❌ Chat Error:", err);
        res.status(500).json({
          reply: "Internal server error while generating response.",
        });
      }
    });

    serveStatic(app, server);

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  });

  try {
    await populateTestData();
    console.log("✅ Memory and test data loaded");
  } catch (err) {
    console.error("❌ Failed to populate test data:", err);
  }
})();
