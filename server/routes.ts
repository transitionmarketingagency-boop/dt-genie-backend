import { Router, type Request, type Response } from "express";

const router = Router();

// Health check
router.get("/api/health", (req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Example chat endpoint placeholder (replace with your real logic)
router.post("/api/chat", (req: Request, res: Response) => {
  // Type request body explicitly if possible
  const body: { message?: string; sessionId?: string } = req.body;
  if (!body.message || !body.sessionId) {
    return res.status(400).json({ error: "Missing message or sessionId" });
  }

  res.json({ reply: `Echo: ${body.message}`, sessionId: body.sessionId });
});

// Example memory endpoint placeholder
router.get("/api/memory/:conversationId", (req: Request, res: Response) => {
  const { conversationId } = req.params;
  res.json({ conversationId, entries: [] });
});

// Add more routes here as needed, always export router at the end

export default router;

