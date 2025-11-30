// server/index-prod.ts

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Express } from "express";
import runApp from "./app.ts";

// Resolve __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths for built frontend and public assets
const distPublicPath = path.resolve(__dirname, "../client");
const publicPath = path.resolve(__dirname, "../public");

// Static file serving function
function serveStatic(app: Express) {
  // Serve built frontend
  if (fs.existsSync(distPublicPath)) {
    app.use(express.static(distPublicPath));
  }

  // Serve public files (like widget.js)
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

// Boot production server
(async () => {
  await runApp(serveStatic);
})();
