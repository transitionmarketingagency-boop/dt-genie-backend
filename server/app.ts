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
import { registerRoutes } from "./routes";

dotenv.config();

const app = express();

// Core middleware
app.use(cors());
app.set("trust proxy", 1);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

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

  // Serve static files BEFORE Vite middleware
  app.use(express.static(path.join(import.meta.dirname, '../public')));

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

async function startServer() {
  const PORT = parseInt(process.env.PORT || "5000", 10);
  
  // Register all API routes
  const httpServer = await registerRoutes(app);

  // Setup Vite for development
  await setupVite(app, httpServer);

  return new Promise<Server>(resolve => {
    httpServer.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
      resolve(httpServer);
    });
  });
}

startServer().catch(console.error);
