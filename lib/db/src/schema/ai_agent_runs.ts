import { pgTable, serial, integer, text, jsonb, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const aiAgentRunsTable = pgTable("ai_agent_runs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  title: text("title").notNull(),
  goal: text("goal").notNull(),
  status: text("status").notNull().default("pending"),
  totalSteps: integer("total_steps").notNull().default(0),
  completedSteps: integer("completed_steps").notNull().default(0),
  result: text("result"),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const aiAgentStepsTable = pgTable("ai_agent_steps", {
  id: serial("id").primaryKey(),
  agentRunId: integer("agent_run_id").notNull().references(() => aiAgentRunsTable.id),
  stepNumber: integer("step_number").notNull(),
  stepType: text("step_type").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("pending"),
  input: jsonb("input"),
  output: jsonb("output"),
  confidenceScore: real("confidence_score"),
  requiresConfirmation: integer("requires_confirmation").notNull().default(0),
  confirmedAt: timestamp("confirmed_at"),
  errorMessage: text("error_message"),
  executedAt: timestamp("executed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAiAgentRunSchema = createInsertSchema(aiAgentRunsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAiAgentStepSchema = createInsertSchema(aiAgentStepsTable).omit({ id: true, createdAt: true });

export type InsertAiAgentRun = z.infer<typeof insertAiAgentRunSchema>;
export type AiAgentRun = typeof aiAgentRunsTable.$inferSelect;
export type InsertAiAgentStep = z.infer<typeof insertAiAgentStepSchema>;
export type AiAgentStep = typeof aiAgentStepsTable.$inferSelect;
