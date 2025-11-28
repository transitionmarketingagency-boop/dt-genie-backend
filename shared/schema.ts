// shared/schema.ts
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ---------------- USERS ----------------
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

// Drizzle-Zod insert schema
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

// Explicit TypeScript interfaces
export interface InsertUser extends z.infer<typeof insertUserSchema> {}
export interface User extends Omit<z.infer<typeof insertUserSchema>, never> {
  id: string;
}

// ---------------- CHAT MESSAGES ----------------
export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: text("session_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  timestamp: true,
});

// Explicit TypeScript interfaces
export interface InsertChatMessage extends z.infer<typeof insertChatMessageSchema> {}
export interface ChatMessage extends Omit<z.infer<typeof insertChatMessageSchema>, never> {
  id: string;
  timestamp: Date;
}

// ---------------- CHAT REQUEST / RESPONSE ----------------
export const chatRequestSchema = z.object({
  message: z.string().min(1),
  sessionId: z.string().min(1),
});

export interface ChatRequest extends z.infer<typeof chatRequestSchema> {}

export const chatResponseSchema = z.object({
  reply: z.string(),
  sessionId: z.string(),
});

export interface ChatResponse extends z.infer<typeof chatResponseSchema> {}

