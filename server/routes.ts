import { Router, type Request, type Response } from "express";
import { generateHybridResponse } from "./services/generateHybridResponse";

const router = Router();

router.get("/api/health", (req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

router.post("/api/chat", async (req: Request, res: Response) => {
  const body: { message?: string; sessionId?: string } = req.body;

  if (!body.message || !body.sessionId) {
    return res.status(400).json({ error: "Missing message or sessionId" });
  }

  try {
     const reply = await generateHybridResponse(body.sessionId, body.message);

    res.json({
      reply,
      sessionId: body.sessionId
    });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: "Failed to generate response" });
  }
});

router.get("/api/memory/:conversationId", (req: Request, res: Response) => {
  const { conversationId } = req.params;
  res.json({ conversationId, entries: [] });
});

export default router;
