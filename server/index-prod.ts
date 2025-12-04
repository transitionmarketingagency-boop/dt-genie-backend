import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Application } from "express";
import type { Server } from "node:http";

// ✅ ESM-compatible imports (point to .js in dist)
import runApp from "./app.js";
import { setupApp } from "./app.js";
import populateTestData from "./populate-test-data.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function serveStatic(app: Application, _server: Server) {
  const distPublicPath = path.resolve(__dirname, "../dist/public");
  const publicPath = path.resolve(__dirname, "../public");

  if (fs.existsSync(distPublicPath)) app.use(express.static(distPublicPath));
  if (fs.existsSync(publicPath)) app.use(express.static(publicPath));

  // SPA fallback
  app.get("*", (req, res, next) => {
    const indexPath = path.join(distPublicPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      next();
    }
  });
}

(async () => {
  // ✅ runApp callback signature with Application & Server
  await runApp(async (app: Application, server: Server) => {
    await setupApp(app);   // API routes first
    serveStatic(app, server); // Static files after
  });

  try {
    await populateTestData();
    console.log("🚀 Memory and history successfully populated!");
  } catch (err) {
    console.error("❌ Failed to populate test data:", err);
  }

  console.log("✅ Server is ready and test data is seeded.");
})();
