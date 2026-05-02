import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const aiPromptLogsTable = pgTable("ai_prompt_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  prompt: text("prompt").notNull(),
  intent: text("intent").notNull().default("general"),
  response: text("response").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAiPromptLogSchema = createInsertSchema(aiPromptLogsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertAiPromptLog = z.infer<typeof insertAiPromptLogSchema>;
export type AiPromptLog = typeof aiPromptLogsTable.$inferSelect;
