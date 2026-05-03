import { pgTable, serial, integer, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  assignedToUserId: integer("assigned_to_user_id").references(() => usersTable.id),
  title: text("title").notNull(),
  description: text("description"),
  module: text("module"),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  priority: text("priority").notNull().default("normal"),
  status: text("status").notNull().default("open"),
  source: text("source").notNull().default("manual"),
  dueDate: timestamp("due_date"),
  reminderAt: timestamp("reminder_at"),
  completedAt: timestamp("completed_at"),
  tags: jsonb("tags"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({ id: true, createdAt: true, updatedAt: true });

export type Task = typeof tasksTable.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
