// server/routes.ts
import { Router, type Request, type Response } from "express";
import { generateHybridResponse } from "./services/generateHybridResponse.js";
import { getTopChunks } from "./queryChunks.js"; // RAG chunks query
import { enforceBotName } from "./system/identity.js";
import { formatResponse } from "./utils/formatResponse.js";
import { cleanResponse } from "./utils/cleanResponse.js";

const router = Router();

/* ================= HEALTH CHECK ================= */
router.get("/api/health", (req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/* ================= CHAT ENDPOINT ================= */
router.post("/api/chat", async (req: Request, res: Response) => {
  const body: { message?: string; sessionId?: string; history?: any[] } = req.body;

  if (!body.message || !body.sessionId) {
    return res.status(400).json({ error: "Missing message or sessionId" });
  }

  try {
    // ------------------ Retrieve top chunks for RAG ------------------
    const topChunks = await getTopChunks(body.message, 10, 0.15); // limit=10, min similarity=0.15

    if (!topChunks || topChunks.length === 0) {
      console.warn("[Chat] ⚠️ No relevant chunks found for query:", body.message);
    }

    // ------------------ Generate hybrid response ------------------
    // Pass message, sessionId, history, and topChunks for context
    const rawReply = await generateHybridResponse({
      message: body.message,
      sessionId: body.sessionId,
      history: body.history || [],
      contextChunks: topChunks,
    });

    // ------------------ Clean and enforce identity ------------------
    let cleanedReply = cleanResponse(rawReply);
    cleanedReply = enforceBotName(cleanedReply);

    // ------------------ Format structured response ------------------
    const formattedReply = formatResponse(null, [{ content: cleanedReply }], { includeCalendly: false });

    // ------------------ Return structured response ------------------
    res.json({
      ok: true,
      reply: formattedReply,
      sessionId: body.sessionId,
      history: body.history || [],
      ragChunksCount: topChunks.length,
    });
  } catch (error) {
    console.error("[Chat] Error handling chat request:", error);

    res.json({
      ok: true,
      reply: "No response received due to internal error.",
      sessionId: body.sessionId,
      history: body.history || [],
      ragChunksCount: 0,
    });
  }
});

/* ================= MEMORY ENDPOINT ================= */
router.get("/api/memory/:conversationId", (req: Request, res: Response) => {
  const { conversationId } = req.params;
  res.json({ conversationId, entries: [] }); // Placeholder for future memory system
});

export default router;
