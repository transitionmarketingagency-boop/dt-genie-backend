import { Router, type Request, type Response } from "express";

const router = Router();

/**
 * Health Check
 */
router.get("/api/health", (req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/**
 * Chat Endpoint (Placeholder)
 */
router.post("/api/chat", (req: Request, res: Response) => {
  const body: { message?: string; sessionId?: string } = req.body;

  if (!body.message || !body.sessionId) {
    return res.status(400).json({ error: "Missing message or sessionId" });
  }

  res.json({
    reply: `Echo: ${body.message}`,
    sessionId: body.sessionId
  });
});

/**
 * Memory Endpoint (Placeholder)
 */
router.get("/api/memory/:conversationId", (req: Request, res: Response) => {
  const { conversationId } = req.params;

  res.json({
    conversationId,
    entries: []
  });
});

export default router;


