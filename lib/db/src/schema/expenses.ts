import { pgTable, serial, integer, text, numeric, boolean, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { vendorsTable } from "./vendors";

export const expensesTable = pgTable("expenses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  vendorId: integer("vendor_id").references(() => vendorsTable.id),
  vendorName: text("vendor_name"),
  expenseNumber: text("expense_number").notNull().unique(),
  category: text("category").notNull().default("general"),
  description: text("description"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull().default("0"),
  gstAmount: numeric("gst_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  gstRate: numeric("gst_rate", { precision: 4, scale: 1 }).default("0"),
  hsnCode: text("hsn_code"),
  status: text("status").notNull().default("pending"),
  paymentMethod: text("payment_method").default("bank_transfer"),
  referenceNumber: text("reference_number"),
  expenseDate: date("expense_date").notNull(),
  dueDate: date("due_date"),
  paidAt: timestamp("paid_at"),
  notes: text("notes"),
  receiptUrl: text("receipt_url"),
  isRecurring: boolean("is_recurring").notNull().default(false),
  recurringPeriod: text("recurring_period"),
  approvalStatus: text("approval_status").notNull().default("not_required"),
  approvedByUserId: integer("approved_by_user_id"),
  approvedAt: timestamp("approved_at"),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertExpenseSchema = createInsertSchema(expensesTable).omit({
  id: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expensesTable.$inferSelect;
