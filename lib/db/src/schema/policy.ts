import { pgTable, serial, integer, text, real, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const policyRulesTable = pgTable("policy_rules", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  name: text("name").notNull(),
  description: text("description"),
  module: text("module").notNull(),
  conditionType: text("condition_type").notNull(),
  conditionOperator: text("condition_operator").notNull().default("gt"),
  conditionValue: real("condition_value"),
  conditionField: text("condition_field"),
  action: text("action").notNull().default("require_approval"),
  isActive: integer("is_active").notNull().default(1),
  priority: integer("priority").notNull().default(0),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const policyViolationsTable = pgTable("policy_violations", {
  id: serial("id").primaryKey(),
  policyRuleId: integer("policy_rule_id").notNull().references(() => policyRulesTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  module: text("module").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  violationDetail: text("violation_detail").notNull(),
  actionTaken: text("action_taken").notNull().default("blocked"),
  status: text("status").notNull().default("open"),
  resolvedByUserId: integer("resolved_by_user_id").references(() => usersTable.id),
  resolvedAt: timestamp("resolved_at"),
  resolutionNote: text("resolution_note"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPolicyRuleSchema = createInsertSchema(policyRulesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPolicyViolationSchema = createInsertSchema(policyViolationsTable).omit({ id: true, createdAt: true });

export type PolicyRule = typeof policyRulesTable.$inferSelect;
export type PolicyViolation = typeof policyViolationsTable.$inferSelect;
export type InsertPolicyRule = z.infer<typeof insertPolicyRuleSchema>;
