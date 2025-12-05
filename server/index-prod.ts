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

  if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
    console.log("✅ Public folder served at /");
  }

  if (fs.existsSync(distPublicPath)) {
    app.use(express.static(distPublicPath));
    console.log("✅ Dist folder served at /");
  }

  app.get("*", (req, res, next) => {
    const indexPath = path.join(distPublicPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      next();
    }
  });
}

// ⛔ Prevent double server listen on Render
// Render runs "node dist/server/index-prod.js" → it should be the ONLY one starting the server.
const isRender = !!process.env.RENDER;

(async () => {
  // ⛔ Only auto-start server if NOT running on Render
  if (!isRender) {
    await runApp(async (app: Application, server: Server) => {
      await setupApp(app);
      serveStatic(app, server);

      const PORT = process.env.PORT || 5000;
      server.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
      });
    });
  }

  try {
    await populateTestData();
    console.log("🚀 Memory and history successfully populated!");
  } catch (err) {
    console.error("❌ Failed to populate test data:", err);
  }

  console.log("✅ Server is ready and test data is seeded.");
})();