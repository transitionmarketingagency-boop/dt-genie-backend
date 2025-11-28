import fs from "node:fs";
import path from "node:path";
import { type Server, createServer } from "node:http";

import express, { type Express } from "express";
import { nanoid } from "nanoid";
import { createServer as createViteServer, createLogger } from "vite";

import viteConfig from "../vite.config";

// ---------- Setup Vite middleware ----------
export async function setupVite(app: Express, server: Server) {
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
      error: (msg: any, options: any) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  // Serve static files BEFORE Vite middleware
  app.use(express.static(path.join(import.meta.dirname, "../public")));

  // Attach Vite middleware
  app.use(vite.middlewares);

  // Handle all requests
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

// ---------- Start Dev Server ----------
async function startDevServer() {
  const app = express();
  const server = createServer(app); // <-- fixed: removed 'new' and destructured createServer

  await setupVite(app, server);

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`Dev server running on port ${PORT}`);
  });
}

// ---------- Launch ----------
startDevServer().catch((err) => {
  console.error("Failed to start dev server:", err);
  process.exit(1);
});

