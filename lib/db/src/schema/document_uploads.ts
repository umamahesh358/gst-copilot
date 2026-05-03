import { pgTable, serial, integer, text, numeric, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const documentUploadsTable = pgTable("document_uploads", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSizeBytes: integer("file_size_bytes"),
  documentType: text("document_type").notNull().default("invoice"),
  status: text("status").notNull().default("uploaded"),
  ocrStatus: text("ocr_status").notNull().default("pending"),
  ocrConfidence: numeric("ocr_confidence", { precision: 4, scale: 2 }),
  extractedData: jsonb("extracted_data"),
  reviewedData: jsonb("reviewed_data"),
  isConfirmed: boolean("is_confirmed").notNull().default(false),
  linkedEntityType: text("linked_entity_type"),
  linkedEntityId: text("linked_entity_id"),
  notes: text("notes"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDocumentUploadSchema = createInsertSchema(documentUploadsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDocumentUpload = z.infer<typeof insertDocumentUploadSchema>;
export type DocumentUpload = typeof documentUploadsTable.$inferSelect;
