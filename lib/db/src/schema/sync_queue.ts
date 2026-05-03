import { pgTable, serial, text, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const syncQueueTable = pgTable("sync_queue", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  deviceId: text("device_id"),
  operation: text("operation").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  payload: jsonb("payload"),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  conflictMarker: text("conflict_marker"),
  hasConflict: boolean("has_conflict").notNull().default(false),
  processedAt: timestamp("processed_at"),
  failedAt: timestamp("failed_at"),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSyncQueueSchema = createInsertSchema(syncQueueTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSyncQueue = z.infer<typeof insertSyncQueueSchema>;
export type SyncQueue = typeof syncQueueTable.$inferSelect;
