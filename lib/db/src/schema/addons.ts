import { pgTable, serial, integer, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const addOnsTable = pgTable("add_ons", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("general"),
  version: text("version").notNull().default("1.0.0"),
  author: text("author"),
  iconUrl: text("icon_url"),
  permissions: jsonb("permissions"),
  minPlan: text("min_plan").notNull().default("pro"),
  isActive: integer("is_active").notNull().default(1),
  isFeatured: integer("is_featured").notNull().default(0),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const addOnInstallsTable = pgTable("add_on_installs", {
  id: serial("id").primaryKey(),
  addOnId: integer("add_on_id").notNull().references(() => addOnsTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  status: text("status").notNull().default("active"),
  config: jsonb("config"),
  installedAt: timestamp("installed_at").notNull().defaultNow(),
  deactivatedAt: timestamp("deactivated_at"),
});

export const insertAddOnSchema = createInsertSchema(addOnsTable).omit({ id: true, createdAt: true });
export const insertAddOnInstallSchema = createInsertSchema(addOnInstallsTable).omit({ id: true, installedAt: true });

export type AddOn = typeof addOnsTable.$inferSelect;
export type AddOnInstall = typeof addOnInstallsTable.$inferSelect;
export type InsertAddOn = z.infer<typeof insertAddOnSchema>;
