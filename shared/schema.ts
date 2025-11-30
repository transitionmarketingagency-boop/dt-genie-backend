// shared/schema.ts

import { pgTable, text, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// --------------------------------------
// USER TABLE
// --------------------------------------
export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  username: varchar("username").notNull(),
  email: varchar("email").notNull(),
  password: text("password").notNull(),
});

// Insert schema (drizzle-zod)
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  password: true,
});

<<<<<<< HEAD
<<<<<<< HEAD
// Explicit TS interfaces
=======
// ✅ Explicit TS interfaces for clarity
>>>>>>> 307d96c ("Fix shared/schema.ts Zod types for Drizzle-Zod compatibility and TypeScript inference")
export interface InsertUser extends z.infer<typeof insertUserSchema> {}
export interface User extends typeof users.$inferSelect {}
=======
export interface User extends z.infer<typeof users.$inferSelect> {}
export interface InsertUser extends z.infer<typeof insertUserSchema> {}
>>>>>>> 3d7de80 (Resolve conflicts: update server and shared configs)

// --------------------------------------
// CHAT MESSAGE TYPES (in-memory storage)
// --------------------------------------
export interface ChatMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface InsertChatMessage
  extends Omit<ChatMessage, "id" | "timestamp"> {}

<<<<<<< HEAD
// Explicit interfaces
export interface InsertChatMessage
  extends z.infer<typeof insertChatMessageSchema> {}

export interface ChatMessage extends typeof chatMessages.$inferSelect {}

// ---------------- CHAT REQUEST/RESPONSE ----------------
export const chatRequestSchema = z.object({
  message: z.string().min(1),
  sessionId: z.string().min(1),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

export const chatResponseSchema = z.object({
  reply: z.string(),
  sessionId: z.string(),
});
<<<<<<< HEAD

=======
>>>>>>> 307d96c ("Fix shared/schema.ts Zod types for Drizzle-Zod compatibility and TypeScript inference")
export type ChatResponse = z.infer<typeof chatResponseSchema>;
=======
>>>>>>> 3d7de80 (Resolve conflicts: update server and shared configs)
