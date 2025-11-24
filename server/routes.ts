import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { chatRequestSchema } from "@shared/schema";
import { z } from "zod";

const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const HUGGINGFACE_MODEL = "meta-llama/Meta-Llama-3.1-8B-Instruct";

const systemPrompt = `You are the AI assistant of Digital Transition Marketing.
Services: Social media marketing, content creation, SEO, SEM, AI ads, automated funnels, web development, branding, and CGI property tours.
Industries: e-commerce, technology, real estate, travel & tourism.
Voice: futuristic, helpful, expert, results-driven, friendly.
Provide concise answers, ask a follow-up question, and if user wants to book a call, ask for Name + Email and then show booking link: https://calendly.com/`;

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, sessionId } = chatRequestSchema.parse(req.body);

      await storage.addChatMessage({
        sessionId,
        role: "user",
        content: message,
      });

      const history = await storage.getChatHistory(sessionId);
      
      const messages = [
        { role: "system", content: systemPrompt },
        ...history.slice(-10).map(msg => ({
          role: msg.role === "assistant" ? "assistant" : "user",
          content: msg.content,
        })),
      ];

      if (!HUGGINGFACE_API_KEY) {
        return res.status(500).json({
          error: "HuggingFace API key not configured. Please add HUGGINGFACE_API_KEY to your environment variables.",
        });
      }

      const response = await fetch(
        `https://api-inference.huggingface.co/models/${HUGGINGFACE_MODEL}/v1/chat/completions`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${HUGGINGFACE_API_KEY}`,
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
          error: `HuggingFace API error: ${response.statusText}`,
          details: errorText,
        });
      }

      const data = await response.json();
      const assistantReply = data.choices?.[0]?.message?.content || "I apologize, but I'm having trouble generating a response right now.";

      await storage.addChatMessage({
        sessionId,
        role: "assistant",
        content: assistantReply,
      });

      res.json({
        reply: assistantReply,
        sessionId,
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

  const httpServer = createServer(app);

  return httpServer;
}
