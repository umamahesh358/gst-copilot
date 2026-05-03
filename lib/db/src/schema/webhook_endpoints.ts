import { pgTable, serial, integer, text, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const webhookEndpointsTable = pgTable("webhook_endpoints", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  name: text("name").notNull(),
  url: text("url").notNull(),
  secret: text("secret"),
  events: jsonb("events").notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  isDeleted: boolean("is_deleted").notNull().default(false),
  description: text("description"),
  headers: jsonb("headers"),
  deliveryCount: integer("delivery_count").notNull().default(0),
  failureCount: integer("failure_count").notNull().default(0),
  lastTriggeredAt: timestamp("last_triggered_at"),
  lastStatus: text("last_status"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type WebhookEndpoint = typeof webhookEndpointsTable.$inferSelect;
