import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const brandingSettingsTable = pgTable("branding_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id).unique(),
  appName: text("app_name").notNull().default("BizOS"),
  tagline: text("tagline"),
  primaryColor: text("primary_color").notNull().default("#4f46e5"),
  accentColor: text("accent_color").notNull().default("#7c3aed"),
  logoUrl: text("logo_url"),
  faviconUrl: text("favicon_url"),
  footerText: text("footer_text"),
  supportEmail: text("support_email"),
  deployMode: text("deploy_mode").notNull().default("cloud"),
  whitelabelEnabled: boolean("whitelabel_enabled").notNull().default(false),
  customDomain: text("custom_domain"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type BrandingSettings = typeof brandingSettingsTable.$inferSelect;
