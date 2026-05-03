import { pgTable, serial, integer, text, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const integrationConnectionsTable = pgTable("integration_connections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  provider: text("provider").notNull(),
  providerType: text("provider_type").notNull(),
  displayName: text("display_name"),
  credentials: text("credentials"),
  config: jsonb("config"),
  status: text("status").notNull().default("disconnected"),
  isActive: boolean("is_active").notNull().default(false),
  isDeleted: boolean("is_deleted").notNull().default(false),
  healthStatus: text("health_status").default("unknown"),
  lastTestedAt: timestamp("last_tested_at"),
  lastSyncAt: timestamp("last_sync_at"),
  lastErrorAt: timestamp("last_error_at"),
  lastError: text("last_error"),
  syncCount: integer("sync_count").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type IntegrationConnection = typeof integrationConnectionsTable.$inferSelect;
