import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const devicesTable = pgTable("devices", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  deviceId: text("device_id").notNull().unique(),
  name: text("name").notNull(),
  platform: text("platform").notNull().default("web"),
  browserInfo: text("browser_info"),
  ipAddress: text("ip_address"),
  isRevoked: boolean("is_revoked").notNull().default(false),
  isTrusted: boolean("is_trusted").notNull().default(true),
  lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
  registeredAt: timestamp("registered_at").notNull().defaultNow(),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDeviceSchema = createInsertSchema(devicesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type Device = typeof devicesTable.$inferSelect;
