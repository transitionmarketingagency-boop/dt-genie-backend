import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Express } from "express";
import type { Server } from "node:http";

import runApp from "./app";
import populateTestData from "./populate-test-data";

// --------------------- RESOLVE __dirname ---------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------------------- STATIC SERVING --------------------
export function serveStatic(app: Express, _server: Server) {
  const distPublicPath = path.resolve(__dirname, "../dist/public");
  const publicPath = path.resolve(__dirname, "../public");

  // Serve built frontend
  if (fs.existsSync(distPublicPath)) {
    app.use(express.static(distPublicPath));
  }

  // Serve public files (widget.js, assets, etc.)
  if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
  }

  // SPA fallback
  app.use("*", (_req, res) => {
    const indexPath = path.join(distPublicPath, "index.html");

    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send("Not Found");
    }
  });
}

// -------------------- MAIN ENTRY --------------------
(async () => {
  // Start backend server with static handler
  await runApp(serveStatic);

  // Try seeding test data
  try {
    await populateTestData();
    console.log("🚀 Memory and history successfully populated!");
  } catch (err) {
    console.error("❌ Failed to populate test data:", err);
  }

  console.log("✅ Server is ready and test data is seeded.");
})();

