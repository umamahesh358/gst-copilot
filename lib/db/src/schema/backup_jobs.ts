import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const backupJobsTable = pgTable("backup_jobs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  status: text("status").notNull().default("pending"),
  type: text("type").notNull().default("manual"),
  label: text("label"),
  sizeBytesEstimate: integer("size_bytes_estimate"),
  recordCount: integer("record_count"),
  tables: jsonb("tables").$type<string[]>(),
  backupData: jsonb("backup_data"),
  checksum: text("checksum"),
  notes: text("notes"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  expiresAt: timestamp("expires_at"),
  restoredAt: timestamp("restored_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBackupJobSchema = createInsertSchema(backupJobsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertBackupJob = z.infer<typeof insertBackupJobSchema>;
export type BackupJob = typeof backupJobsTable.$inferSelect;
