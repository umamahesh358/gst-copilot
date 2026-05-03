import { pgTable, serial, integer, text, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const customFieldsTable = pgTable("custom_fields", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  module: text("module").notNull(),
  name: text("name").notNull(),
  label: text("label").notNull(),
  fieldType: text("field_type").notNull().default("text"),
  isRequired: boolean("is_required").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  isDeleted: boolean("is_deleted").notNull().default(false),
  options: jsonb("options"),
  defaultValue: text("default_value"),
  placeholder: text("placeholder"),
  validationRule: text("validation_rule"),
  displayOrder: integer("display_order").notNull().default(0),
  showInList: boolean("show_in_list").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const customFieldValuesTable = pgTable("custom_field_values", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  customFieldId: integer("custom_field_id").notNull().references(() => customFieldsTable.id),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  value: text("value"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type CustomField = typeof customFieldsTable.$inferSelect;
export type CustomFieldValue = typeof customFieldValuesTable.$inferSelect;
