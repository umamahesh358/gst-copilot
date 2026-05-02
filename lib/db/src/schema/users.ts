import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  businessName: text("business_name").notNull().default("My Business"),
  plan: text("plan").notNull().default("free"),
  onboardingComplete: boolean("onboarding_complete").notNull().default(false),
  aiPromptsUsed: integer("ai_prompts_used").notNull().default(0),
  aiPromptsLimit: integer("ai_prompts_limit").notNull().default(3),
  businessType: text("business_type"),
  gstNumber: text("gst_number"),
  address: text("address"),
  phone: text("phone"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  passwordHash: true,
  plan: true,
  onboardingComplete: true,
  aiPromptsUsed: true,
  aiPromptsLimit: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
