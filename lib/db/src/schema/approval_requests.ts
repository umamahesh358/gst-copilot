import { pgTable, serial, integer, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const approvalRequestsTable = pgTable("approval_requests", {
  id: serial("id").primaryKey(),
  requestedByUserId: integer("requested_by_user_id").notNull().references(() => usersTable.id),
  assignedToUserId: integer("assigned_to_user_id").references(() => usersTable.id),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority").notNull().default("normal"),
  status: text("status").notNull().default("pending"),
  payload: jsonb("payload"),
  comments: text("comments"),
  reviewedAt: timestamp("reviewed_at"),
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertApprovalRequestSchema = createInsertSchema(approvalRequestsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertApprovalRequest = z.infer<typeof insertApprovalRequestSchema>;
export type ApprovalRequest = typeof approvalRequestsTable.$inferSelect;
