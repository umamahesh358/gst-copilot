import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const appSettingsTable = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id).unique(),
  theme: text("theme").notNull().default("dark"),
  businessName: text("business_name").notNull().default("My Business"),
  gstNumber: text("gst_number"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  invoicePrefix: text("invoice_prefix").notNull().default("INV"),
  currency: text("currency").notNull().default("INR"),
  currencySymbol: text("currency_symbol").notNull().default("₹"),
  taxLabel: text("tax_label").notNull().default("GST"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAppSettingsSchema = createInsertSchema(appSettingsTable).omit({
  id: true,
  updatedAt: true,
});

export type InsertAppSettings = z.infer<typeof insertAppSettingsSchema>;
export type AppSettings = typeof appSettingsTable.$inferSelect;
