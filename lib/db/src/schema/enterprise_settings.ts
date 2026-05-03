import { pgTable, serial, integer, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const enterpriseSettingsTable = pgTable("enterprise_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  dataRetentionDays: integer("data_retention_days").notNull().default(365),
  sessionTimeoutMinutes: integer("session_timeout_minutes").notNull().default(480),
  maxDevices: integer("max_devices").notNull().default(5),
  requireMfa: integer("require_mfa").notNull().default(0),
  allowedIpRanges: jsonb("allowed_ip_ranges"),
  apiRateLimitPerMinute: integer("api_rate_limit_per_minute").notNull().default(300),
  auditLevel: text("audit_level").notNull().default("standard"),
  exportPolicy: text("export_policy").notNull().default("allowed"),
  deletionPolicy: text("deletion_policy").notNull().default("soft_delete"),
  complianceMode: text("compliance_mode").notNull().default("standard"),
  alertEmail: text("alert_email"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertEnterpriseSettingsSchema = createInsertSchema(enterpriseSettingsTable).omit({ id: true, createdAt: true, updatedAt: true });

export type EnterpriseSettings = typeof enterpriseSettingsTable.$inferSelect;
export type InsertEnterpriseSettings = z.infer<typeof insertEnterpriseSettingsSchema>;
