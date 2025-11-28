import express from "express";
import cors from "cors";
import { storage } from "./storage";
import { memoryStore } from "./services/memory";
import { queryGemini } from "./services/gemini";
import type { MemoryEntry, ChatHistory } from "@shared/types";

export const formatMemory = (memory: MemoryEntry[]): string[] =>
  memory.slice(-20).map((m) => `[${m.source.toUpperCase()}] ${m.chunk}`);

export const formatHistory = (history: ChatHistory[]): string[] =>
  history.slice(-10).map(
    (h) => `${h.role === "assistant" ? "Assistant" : "User"}: ${h.content}`
  );

export const getFormattedHistoryObjects = (history: ChatHistory[]): ChatHistory[] =>
  history.slice(-10).map((h) => ({ role: h.role, content: h.content }));

export const setupApp = async (app: express.Application, sessionId: string) => {
  app.use(cors());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  const memoryData: MemoryEntry[] = memoryStore.getAllMemory() as MemoryEntry[];
  const formattedMemory = formatMemory(memoryData);

  const chatHistory: ChatHistory[] = await storage.getChatHistory(sessionId);
  const formattedHistory = formatHistory(chatHistory);

  console.log("Memory:", formattedMemory);
  console.log("History:", formattedHistory);

  const message: string = "Hello from backend";
  const response: string = await queryGemini(message);
  console.log("Gemini reply:", response);

  app.get("/test-gemini", async (req, res) => {
    const reply: string = await queryGemini("Test message");
    res.json({ reply });
  });
};