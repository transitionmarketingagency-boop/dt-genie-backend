// server/routes.ts
import { Router, type Request, type Response } from "express";
import { generateHybridResponse } from "./services/generateHybridResponse.js";

const router = Router();

router.get("/api/health", (req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

router.post("/api/chat", async (req: Request, res: Response) => {
  const body: { message?: string; sessionId?: string; history?: any[] } = req.body;

  if (!body.message || !body.sessionId) {
    return res.status(400).json({ error: "Missing message or sessionId" });
  }

  try {
    // ------------------ Call hybrid response ------------------
    const reply = await generateHybridResponse(body.message, body.sessionId);

    // ------------------ Always return reply + sessionId + history ------------------
    res.json({
      ok: true,
      reply,
      sessionId: body.sessionId,
      history: body.history || [],
    });
  } catch (error) {
    console.error("Chat error:", error);

    // Return structured JSON even on failure
    res.json({
      ok: true,
      reply: "No response received.",
      sessionId: body.sessionId,
      history: body.history || [],
    });
  }
});

router.get("/api/memory/:conversationId", (req: Request, res: Response) => {
  const { conversationId } = req.params;
  res.json({ conversationId, entries: [] });
});

export default router;

