import fs from "node:fs";
import path from "node:path";
import { type Server } from "node:http";

import express, { type Express } from "express";
import runApp from "./app";

export async function serveStatic(app: Express, _server: Server) {
  const distPublicPath = path.resolve(import.meta.dirname, "../dist/public");
  const publicPath = path.resolve(import.meta.dirname, "../public");

  // Serve static files from dist/public (built frontend)
  if (fs.existsSync(distPublicPath)) {
    app.use(express.static(distPublicPath));
  }
  
  // Also serve from root public directory (widget files)
  if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
  }

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    const indexPath = path.resolve(distPublicPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send("Not Found");
    }
  });
}

(async () => {
  await runApp(serveStatic);
})();
