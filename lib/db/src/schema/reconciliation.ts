import { pgTable, serial, integer, text, real, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const reconciliationJobsTable = pgTable("reconciliation_jobs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  name: text("name").notNull(),
  bankName: text("bank_name"),
  accountNumber: text("account_number"),
  statementPeriodStart: timestamp("statement_period_start"),
  statementPeriodEnd: timestamp("statement_period_end"),
  totalRows: integer("total_rows").notNull().default(0),
  matchedRows: integer("matched_rows").notNull().default(0),
  unmatchedRows: integer("unmatched_rows").notNull().default(0),
  pendingRows: integer("pending_rows").notNull().default(0),
  status: text("status").notNull().default("pending"),
  rawFileUrl: text("raw_file_url"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const bankStatementRowsTable = pgTable("bank_statement_rows", {
  id: serial("id").primaryKey(),
  reconciliationJobId: integer("reconciliation_job_id").notNull().references(() => reconciliationJobsTable.id),
  rowIndex: integer("row_index").notNull(),
  transactionDate: timestamp("transaction_date"),
  description: text("description"),
  reference: text("reference"),
  debit: real("debit"),
  credit: real("credit"),
  balance: real("balance"),
  currency: text("currency").notNull().default("INR"),
  status: text("status").notNull().default("unmatched"),
  normalizedDescription: text("normalized_description"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reconciliationMatchesTable = pgTable("reconciliation_matches", {
  id: serial("id").primaryKey(),
  reconciliationJobId: integer("reconciliation_job_id").notNull().references(() => reconciliationJobsTable.id),
  bankRowId: integer("bank_row_id").notNull().references(() => bankStatementRowsTable.id),
  matchedEntityType: text("matched_entity_type").notNull(),
  matchedEntityId: text("matched_entity_id").notNull(),
  matchType: text("match_type").notNull().default("manual"),
  confidenceScore: real("confidence_score").notNull().default(0),
  matchReason: text("match_reason"),
  status: text("status").notNull().default("pending"),
  reviewedByUserId: integer("reviewed_by_user_id").references(() => usersTable.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertReconciliationJobSchema = createInsertSchema(reconciliationJobsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBankStatementRowSchema = createInsertSchema(bankStatementRowsTable).omit({ id: true, createdAt: true });
export const insertReconciliationMatchSchema = createInsertSchema(reconciliationMatchesTable).omit({ id: true, createdAt: true });

export type ReconciliationJob = typeof reconciliationJobsTable.$inferSelect;
export type BankStatementRow = typeof bankStatementRowsTable.$inferSelect;
export type ReconciliationMatch = typeof reconciliationMatchesTable.$inferSelect;
export type InsertReconciliationJob = z.infer<typeof insertReconciliationJobSchema>;
