import fs from "node:fs";
import path from "node:path";
import { type Server } from "node:http";

import express from "express";
import { nanoid } from "nanoid";
import { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import cors from "cors";
import dotenv from "dotenv";

import viteConfig from "../vite.config";
import router, { registerRoutes } from "./routes.js";
import { queryGemini } from "./services/gemini.js";
import { memoryStore } from "./services/memory.js";

dotenv.config();

const app = express();

// Core middleware
app.use(cors());
app.set("trust proxy", 1);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Basic backend routes
app.use("/", router);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Gemini test
app.get("/test-gemini", async (_req, res) => {
  try {
    const reply = await queryGemini("Say hello! This is a Gemini test.");
    res.json({ ok: true, reply });
  } catch (err) {
    console.error("Gemini test error:", err);
    res.status(500).json({ ok: false, error: "Gemini test failed" });
  }
});

// Debug memory
try {
  const memoryData = memoryStore.getAllMemory?.() || [];
  console.log("Memory loaded:", memoryData);
} catch {
  console.log("No memory store found.");
}

// ------------------- Vite integration -------------------
async function setupVite(app: Express, server: Server) {
  const viteLogger = createLogger();
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  // Serve static files
  app.use(express.static(path.join(import.meta.dirname, "../public")));

  // Apply Vite middleware
  app.use(vite.middlewares);

  // Transform index.html for HMR
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

// ------------------- Start server -------------------
async function main() {
  const PORT = parseInt(process.env.PORT || "5000", 10);

  const httpServer = await registerRoutes(app);
  await setupVite(app, httpServer);

  httpServer.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("Server startup failed:", err);
  process.exit(1);
});
