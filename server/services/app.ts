// server/services/app.ts
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
import { askGemini } from "./gemini.js"; // Gemini helper in same folder

// FIXED: import router instead of registerRoutes
import router from "./routes.ts";

dotenv.config();

export const app = express();

// Apply router (all routes from routes.ts)
app.use(router);

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
app.set("trust proxy", 1); // Trust first proxy for rate-limiting
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Health endpoint
app.get("/api/health", (req, res) => {
  try {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      memory: memoryStore.getAllMemory().length,
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: "Health check failed" });
  }
});

// ... the rest of your endpoints remain exactly the same ...

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

