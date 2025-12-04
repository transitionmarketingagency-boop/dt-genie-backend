import { pgTable, text, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  username: varchar("username").notNull(),
  email: varchar("email").notNull(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  password: true,
});

export interface User extends z.infer<typeof users.$inferSelect> {}
export interface InsertUser extends z.infer<typeof insertUserSchema> {}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface InsertChatMessage extends Omit<ChatMessage, "id" | "timestamp"> {}

export const chatRequestSchema = z.object({
  message: z.string().min(1),
  sessionId: z.string().min(1),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

export const chatResponseSchema = z.object({
  reply: z.string(),
  sessionId: z.string(),
});

export type ChatResponse = z.infer<typeof chatResponseSchema>;