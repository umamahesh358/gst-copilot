import { pgTable, serial, integer, text, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const importJobsTable = pgTable("import_jobs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  module: text("module").notNull(),
  filename: text("filename").notNull(),
  fileSize: integer("file_size"),
  format: text("format").notNull().default("csv"),
  status: text("status").notNull().default("pending"),
  mapping: jsonb("mapping"),
  preview: jsonb("preview"),
  totalRows: integer("total_rows").default(0),
  importedRows: integer("imported_rows").default(0),
  failedRows: integer("failed_rows").default(0),
  skippedRows: integer("skipped_rows").default(0),
  errors: jsonb("errors"),
  duplicatesFound: integer("duplicates_found").default(0),
  mergeStrategy: text("merge_strategy").default("skip"),
  isDryRun: boolean("is_dry_run").notNull().default(false),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type ImportJob = typeof importJobsTable.$inferSelect;
