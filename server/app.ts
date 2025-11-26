import type { Express } from "express";
import { createServer, type Server } from "http";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { storage } from "./storage";
import { chatRequestSchema } from "@shared/schema";
import { z } from "zod";
import { memoryStore } from "./services/memory";
import { generateEmbedding, chunkText } from "./services/embeddings";
import { crawlWebsite } from "./services/crawler";
import { parseFile } from "./services/fileParser";
import { chatRateLimiter, trainingRateLimiter, memoryRateLimiter } from "./middleware/rateLimit";

dotenv.config();

export const app = express();

const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const HUGGINGFACE_MODEL = "meta-llama/Meta-Llama-3.1-8B-Instruct";

const systemPrompt = `You are the AI assistant of Digital Transition Marketing, a premium marketing consulting firm.

Services: Social media marketing, content creation, SEO, SEM, AI ads, automated funnels, web development, branding, and CGI property tours.
Industries: e-commerce, technology, real estate, travel & tourism.

Voice: Intelligent, premium, friendly, expert, results-driven. You are a high-end marketing consultant.
- Always provide valuable insights
- Never hallucinate - if you don't have information, ask the user to upload documents
- Offer to train on specific documents for personalized responses
- Include booking link when appropriate: https://calendly.com/`;

// Configure multer for file uploads
const upload = multer({
  dest: path.join(process.cwd(), "uploads"),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`));
    }
  },
});

// Core middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Health endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    memory: memoryStore.getAllMemory().length,
  });
});

// Chat endpoint with enhanced context retrieval
app.post("/api/chat", chatRateLimiter, async (req, res) => {
  try {
    const { message, sessionId } = chatRequestSchema.parse(req.body);

    // Store user message
    await storage.addChatMessage({
      sessionId,
      role: "user",
      content: message,
    });

    // Get conversation history
    const history = await storage.getChatHistory(sessionId);

    // Generate embedding for current message to retrieve relevant context
    const messageEmbedding = await generateEmbedding(message);
    const relevantMemory = memoryStore.searchSimilar(messageEmbedding, 3);

    // Build context with system prompt + relevant memory + history
    const contextChunks = relevantMemory
      .map(m => `[${m.source.toUpperCase()}] ${m.chunk}`)
      .join("\n\n");

    const messages = [
      {
        role: "system",
        content: systemPrompt + (contextChunks ? `\n\nKNOWN CONTEXT:\n${contextChunks}` : ""),
      },
      ...history.slice(-10).map(msg => ({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: msg.content,
      })),
    ];

    if (!HUGGINGFACE_API_KEY) {
      return res.status(500).json({
        error: "HuggingFace API key not configured.",
      });
    }

    const response = await fetch(
      `https://api-inference.huggingface.co/models/${HUGGINGFACE_MODEL}/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: HUGGINGFACE_MODEL,
          messages,
          max_tokens: 500,
          temperature: 0.7,
          stream: false,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("HuggingFace API error:", errorText);
      return res.status(response.status).json({
        error: `AI service error: ${response.statusText}`,
      });
    }

    const data = await response.json();
    const assistantReply =
      data.choices?.[0]?.message?.content ||
      "I apologize, but I'm having trouble generating a response right now.";

    // Store assistant reply
    await storage.addChatMessage({
      sessionId,
      role: "assistant",
      content: assistantReply,
    });

    // Add to memory for future context retrieval
    const replyEmbedding = await generateEmbedding(assistantReply);
    memoryStore.addEntry(sessionId, assistantReply, "memory", replyEmbedding);

    res.json({
      reply: assistantReply,
      sessionId,
      contextUsed: relevantMemory.length > 0,
    });
  } catch (error) {
    console.error("Chat endpoint error:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid request",
        details: error.errors,
      });
    }

    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Upload and train endpoint
app.post("/api/train/upload", trainingRateLimiter, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const { sessionId } = req.body;
    if (!sessionId) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "sessionId required" });
    }

    console.log(`Processing file: ${req.file.filename}, Size: ${req.file.size}`);

    // Parse file
    const text = await parseFile(req.file.path, req.file.mimetype);
    console.log(`Extracted text length: ${text.length}`);

    // Chunk the text
    const chunks = chunkText(text, 500, 100);
    console.log(`Created ${chunks.length} chunks`);

    // Generate embeddings and store
    let storedCount = 0;
    for (const chunk of chunks) {
      const embedding = await generateEmbedding(chunk);
      memoryStore.addEntry(sessionId, chunk, "file", embedding);
      storedCount++;

      // Rate limit embedding generation
      if (storedCount % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      fileName: req.file.originalname,
      chunks: chunks.length,
      stored: storedCount,
      message: `Successfully trained on ${req.file.originalname}. This bot now has context from your document.`,
    });
  } catch (error) {
    // Clean up on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.error("Upload error:", error);
    res.status(500).json({
      error: "Failed to process file",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Crawl website endpoint
app.post("/api/train/crawl", trainingRateLimiter, async (req, res) => {
  try {
    const { url, sessionId, maxPages = 10, maxDepth = 2 } = req.body;

    if (!url || !sessionId) {
      return res.status(400).json({ error: "url and sessionId required" });
    }

    res.writeHead(200, {
      "Content-Type": "application/json",
      "Transfer-Encoding": "chunked",
    });

    res.write(JSON.stringify({ status: "started", message: `Starting to crawl ${url}...` }) + "\n");

    try {
      const results = await crawlWebsite(url, maxDepth, maxPages);

      let storedCount = 0;
      for (const result of results) {
        if (result.error) {
          console.log(`Skipped ${result.url}: ${result.error}`);
          continue;
        }

        const chunks = chunkText(result.text, 500, 100);
        for (const chunk of chunks) {
          const embedding = await generateEmbedding(chunk);
          memoryStore.addEntry(
            sessionId,
            `[${result.title}] ${chunk}`,
            "website",
            embedding
          );
          storedCount++;
        }
      }

      res.write(
        JSON.stringify({
          status: "completed",
          pagesScraped: results.length,
          chunksStored: storedCount,
          message: `Successfully trained on ${results.length} pages from ${url}`,
        }) + "\n"
      );
      res.end();
    } catch (error) {
      res.write(
        JSON.stringify({
          status: "error",
          message: error instanceof Error ? error.message : "Crawling failed",
        }) + "\n"
      );
      res.end();
    }
  } catch (error) {
    console.error("Crawl error:", error);
    res.status(500).json({
      error: "Crawl failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get conversation memory
app.get("/api/memory/:conversationId", memoryRateLimiter, (req, res) => {
  try {
    const { conversationId } = req.params;
    const memory = memoryStore.getConversationMemory(conversationId);

    res.json({
      conversationId,
      entriesCount: memory.length,
      entries: memory.slice(-20).map(m => ({
        id: m.id,
        chunk: m.chunk.substring(0, 200),
        source: m.source,
        timestamp: m.timestamp,
      })),
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve memory",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Clear conversation memory
app.delete("/api/memory/:conversationId", (req, res) => {
  try {
    const { conversationId } = req.params;
    memoryStore.clearConversation(conversationId);

    res.json({
      success: true,
      message: "Conversation memory cleared",
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to clear memory",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get all memory (debugging)
app.get("/api/memory", (req, res) => {
  try {
    const all = memoryStore.getAllMemory();
    res.json({
      totalConversations: all.length,
      totalEntries: all.reduce((sum, c) => sum + c.entries.length, 0),
      conversations: all.map(c => ({
        conversationId: c.conversationId,
        entries: c.entries.length,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve memory",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default async function runApp(
  setupFn?: (app: Express, server: Server) => Promise<void>
): Promise<Server> {
  const PORT = parseInt(process.env.PORT || "5000", 10);
  const httpServer = createServer(app);

  if (setupFn) {
    await setupFn(app, httpServer);
  }

  return new Promise(resolve => {
    httpServer.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
      resolve(httpServer);
    });
  });
}
