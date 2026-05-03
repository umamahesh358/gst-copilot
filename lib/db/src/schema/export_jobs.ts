import { pgTable, serial, integer, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const exportJobsTable = pgTable("export_jobs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  module: text("module").notNull(),
  format: text("format").notNull().default("csv"),
  filters: jsonb("filters"),
  status: text("status").notNull().default("pending"),
  rowCount: integer("row_count").default(0),
  fileUrl: text("file_url"),
  fileSize: integer("file_size"),
  errorMessage: text("error_message"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type ExportJob = typeof exportJobsTable.$inferSelect;
