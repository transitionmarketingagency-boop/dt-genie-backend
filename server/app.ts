// server/app.ts

import "dotenv/config";
import fs from "fs";
import path from "path";
import express, { type Application, type Request, type Response } from "express";
import cors from "cors";
import { createServer, type Server } from "node:http";

// Local modules
import { memoryService } from "./services/memoryService.js";
import { populateChunks } from "./populate-chunks.js";
import { generateHybridResponse } from "./services/generateHybridResponse.js";
import { CALENDLY_LINK } from "./config/constants.js";

/* ================= GOOGLE SERVICE ACCOUNT ================= */

if (process.env.SERVICE_ACCOUNT_BASE64) {
  const json = Buffer.from(process.env.SERVICE_ACCOUNT_BASE64, "base64").toString("utf8");

  const keyPath = path.join(process.cwd(), "sa-key.json");

  fs.writeFileSync(keyPath, json);

  process.env.GOOGLE_APPLICATION_CREDENTIALS = keyPath;

  console.log("✅ Google service account initialized");
}

/* ================= SETUP API ROUTES ================= */

export const setupApp = async (app: Application) => {

  app.use(cors({ origin: "*", credentials: true }));
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  /* -------- Serve Public Folder -------- */

  const publicPath = path.join(process.cwd(), "public");

  if (fs.existsSync(publicPath)) {
    app.use("/public", express.static(publicPath));
    console.log("✅ Public folder served:", publicPath);
  }

  /* -------- Populate Chunks (optional) -------- */

  if (process.env.POPULATE_CHUNKS === "true") {
    console.log("⚙️ Populating vector chunks...");
    await populateChunks();
    console.log("✅ Vector chunks populated");
  }

  /* -------- Health Check -------- */

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  });

  /* -------- Gemini Test Route -------- */

  app.get("/test-gemini", (_req, res) => {
    res.json({
      ok: true,
      message: "Gemini test route working!",
    });
  });

  /* ================= CHAT HANDLER ================= */

  const chatHandler = async (req: Request, res: Response) => {

    try {

      let { message, sessionId } = req.body as {
        message?: string;
        sessionId?: string;
      };

      /* -------- Validate Message -------- */

      if (!message || typeof message !== "string" || message.trim().length === 0) {
        return res.status(400).json({
          ok: false,
          error: "Message is required",
        });
      }

      if (!sessionId || typeof sessionId !== "string") {
        sessionId = "default";
      }

      /* -------- Generate Hybrid Response -------- */

      let reply = "";

      try {

        reply = await generateHybridResponse({
          message,
          sessionId,
        });

      } catch (err) {

        console.warn("⚠️ Hybrid response failed:", err);

        reply = "";

      }

      /* -------- Safe Fallback -------- */

      if (!reply || reply.trim().length === 0) {

        reply =
          "I'm here to help with AI marketing strategy, automation, SEO, and CGI advertising. What would you like to explore?";

      }

      /* -------- Save Assistant Message -------- */

      await memoryService.addMessage(sessionId, "assistant", reply);

      /* -------- Get Updated History -------- */

      const history = await memoryService.getHistory(sessionId);

      console.log("✅ Chat response sent");

      res.json({
        ok: true,
        reply,
        history,
      });

    } catch (err) {

      console.error("❌ Chat error:", err);

      res.status(500).json({
        ok: false,
        error: "Chat failed",
      });

    }
  };

  app.post("/api/chat", chatHandler);
};

/* ================= SERVER CREATOR ================= */

export default async function runApp(
  setupFn?: (app: Application, server: Server) => Promise<void>
): Promise<Server> {

  const app: Application = express();

  const httpServer = createServer(app);

  if (setupFn) {
    await setupFn(app, httpServer);
  } else {
    await setupApp(app);
  }

  return httpServer;
}

/* ================= DIRECT RUN ================= */

if (process.argv[1]?.endsWith("app.ts")) {

  const PORT = Number(process.env.PORT) || 5000;

  const app = express();

  const server = createServer(app);

  setupApp(app).then(() => {

    server.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });

  });

}
