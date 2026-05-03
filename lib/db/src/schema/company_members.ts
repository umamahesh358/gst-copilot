import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { companiesTable } from "./companies";

export const companyMembersTable = pgTable("company_members", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  role: text("role").notNull().default("staff"),
  isOwner: boolean("is_owner").notNull().default(false),
  invitedByUserId: integer("invited_by_user_id").references(() => usersTable.id),
  inviteEmail: text("invite_email"),
  inviteStatus: text("invite_status").notNull().default("accepted"),
  permissions: text("permissions").array(),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCompanyMemberSchema = createInsertSchema(companyMembersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCompanyMember = z.infer<typeof insertCompanyMemberSchema>;
export type CompanyMember = typeof companyMembersTable.$inferSelect;
