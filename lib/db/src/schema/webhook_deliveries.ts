import { pgTable, serial, integer, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { webhookEndpointsTable } from "./webhook_endpoints";

export const webhookDeliveriesTable = pgTable("webhook_deliveries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  webhookEndpointId: integer("webhook_endpoint_id").references(() => webhookEndpointsTable.id),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload"),
  status: text("status").notNull().default("pending"),
  responseCode: integer("response_code"),
  responseBody: text("response_body"),
  attemptCount: integer("attempt_count").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  nextRetryAt: timestamp("next_retry_at"),
  deliveredAt: timestamp("delivered_at"),
  errorMessage: text("error_message"),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type WebhookDelivery = typeof webhookDeliveriesTable.$inferSelect;
