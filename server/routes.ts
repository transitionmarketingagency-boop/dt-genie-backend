// server/routes.ts

import { Router, type Request, type Response } from "express";
import { generateHybridResponse } from "./services/generateHybridResponse.js";
import { enforceBotName } from "./system/identity.js";
import { formatResponse } from "./utils/formatResponse.js";
import { cleanResponse } from "./utils/cleanResponse.js";

const router = Router();

/* ================= HEALTH CHECK ================= */

router.get("/api/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "Neon Vision AI",
    timestamp: new Date().toISOString()
  });
});

/* ================= CHAT ENDPOINT ================= */

router.post("/api/chat", async (req: Request, res: Response) => {

  const body = req.body as {
    message?: string;
    sessionId?: string;
    history?: any[];
  };

  if (!body?.message || !body?.sessionId) {
    return res.status(400).json({
      ok: false,
      error: "Missing message or sessionId"
    });
  }

  try {

    /* ===== Generate Hybrid Response ===== */

    const rawReply = await generateHybridResponse({
      message: body.message,
      sessionId: body.sessionId,
      history: Array.isArray(body.history) ? body.history : []
    });

    /* ===== Clean Model Output ===== */

    let cleanedReply = cleanResponse(rawReply || "");

    /* ===== Enforce Neon Vision Identity ===== */

    cleanedReply = enforceBotName(cleanedReply);

    /* ===== Format Final Response ===== */

    const formattedReply = formatResponse(
      null,
      [{ content: cleanedReply }],
      { includeCalendly: false }
    );

    res.json({
      ok: true,
      reply: formattedReply,
      sessionId: body.sessionId,
      history: body.history || []
    });

  } catch (error) {

    console.error("[Chat] Error handling chat request:", error);

    res.json({
      ok: true,
      reply: "I'm Neon Vision, the AI strategist for Digital Transition Marketing. I'm experiencing a temporary processing delay. Please try again in a moment.",
      sessionId: body.sessionId,
      history: body.history || []
    });

  }

});

/* ================= MEMORY ENDPOINT ================= */

router.get("/api/memory/:conversationId", (req: Request, res: Response) => {

  const { conversationId } = req.params;

  res.json({
    conversationId,
    entries: []
  });

});

export default router;
