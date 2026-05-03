import { Router } from "express";
import { db } from "@workspace/db";
import {
  brandingSettingsTable, integrationConnectionsTable, webhookDeliveriesTable,
  importJobsTable, exportJobsTable, auditLogsTable, usersTable,
} from "@workspace/db";
import { eq, desc, and, gte, count, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/system/health", requireAuth, async (req: AuthRequest, res) => {
  const now = new Date();
  const since24h = new Date(now.getTime() - 86400000);

  const [integrationStats] = await db.select({ total: count(), active: sql<number>`sum(case when is_active then 1 else 0 end)` })
    .from(integrationConnectionsTable)
    .where(and(eq(integrationConnectionsTable.userId, req.userId!), eq(integrationConnectionsTable.isDeleted, false)));

  const [webhookStats] = await db.select({ total: count() })
    .from(webhookDeliveriesTable)
    .where(and(eq(webhookDeliveriesTable.userId, req.userId!), gte(webhookDeliveriesTable.createdAt, since24h)));

  const [failedWebhooks] = await db.select({ total: count() })
    .from(webhookDeliveriesTable)
    .where(and(eq(webhookDeliveriesTable.userId, req.userId!), eq(webhookDeliveriesTable.status, "failed"), gte(webhookDeliveriesTable.createdAt, since24h)));

  const [importStats] = await db.select({ total: count() })
    .from(importJobsTable)
    .where(and(eq(importJobsTable.userId, req.userId!), gte(importJobsTable.createdAt, since24h)));

  const [auditStats] = await db.select({ total: count() })
    .from(auditLogsTable)
    .where(and(eq(auditLogsTable.userId, req.userId!), gte(auditLogsTable.createdAt, since24h)));

  const recentErrors = await db.select().from(auditLogsTable)
    .where(and(eq(auditLogsTable.userId, req.userId!), eq(auditLogsTable.status, "failure")))
    .orderBy(desc(auditLogsTable.createdAt)).limit(5);

  res.json({
    status: "healthy",
    timestamp: now.toISOString(),
    metrics: {
      integrations: { total: Number(integrationStats?.total ?? 0), active: Number(integrationStats?.active ?? 0) },
      webhooks24h: { total: Number(webhookStats?.total ?? 0), failed: Number(failedWebhooks?.total ?? 0) },
      imports24h: Number(importStats?.total ?? 0),
      auditEvents24h: Number(auditStats?.total ?? 0),
    },
    recentErrors,
  });
});

router.get("/system/branding", requireAuth, async (req: AuthRequest, res) => {
  const [settings] = await db.select().from(brandingSettingsTable)
    .where(eq(brandingSettingsTable.userId, req.userId!)).limit(1);

  if (!settings) {
    res.json({
      branding: {
        appName: "BizOS", tagline: "AI-Powered ERP for Indian SMEs",
        primaryColor: "#4f46e5", accentColor: "#7c3aed",
        logoUrl: null, faviconUrl: null, footerText: null,
        supportEmail: null, deployMode: "cloud", whitelabelEnabled: false, customDomain: null,
      }
    });
    return;
  }
  res.json({ branding: settings });
});

router.put("/system/branding", requireAuth, async (req: AuthRequest, res) => {
  const { appName, tagline, primaryColor, accentColor, logoUrl, faviconUrl, footerText, supportEmail, deployMode, whitelabelEnabled, customDomain } = req.body;

  const existing = await db.select().from(brandingSettingsTable)
    .where(eq(brandingSettingsTable.userId, req.userId!)).limit(1);

  let branding;
  if (existing.length > 0) {
    [branding] = await db.update(brandingSettingsTable).set({
      appName, tagline, primaryColor, accentColor, logoUrl, faviconUrl, footerText, supportEmail, deployMode, whitelabelEnabled, customDomain,
      updatedAt: new Date(),
    }).where(eq(brandingSettingsTable.userId, req.userId!)).returning();
  } else {
    [branding] = await db.insert(brandingSettingsTable).values({
      userId: req.userId!,
      appName: appName ?? "BizOS",
      tagline, primaryColor: primaryColor ?? "#4f46e5", accentColor: accentColor ?? "#7c3aed",
      logoUrl, faviconUrl, footerText, supportEmail, deployMode: deployMode ?? "cloud",
      whitelabelEnabled: whitelabelEnabled ?? false, customDomain,
    }).returning();
  }

  await db.insert(auditLogsTable).values({
    userId: req.userId!,
    action: "branding_updated",
    entity: "branding",
    entityId: String(req.userId),
    description: "Branding settings updated",
  });

  res.json({ branding });
});

router.get("/system/activity-summary", requireAuth, async (req: AuthRequest, res) => {
  const since7d = new Date(Date.now() - 7 * 86400000);
  const events = await db.select({
    action: auditLogsTable.action,
    entity: auditLogsTable.entity,
    count: count(),
  }).from(auditLogsTable)
    .where(and(eq(auditLogsTable.userId, req.userId!), gte(auditLogsTable.createdAt, since7d)))
    .groupBy(auditLogsTable.action, auditLogsTable.entity)
    .orderBy(desc(count()))
    .limit(20);

  res.json({ events, since: since7d.toISOString() });
});

router.get("/system/deployment", requireAuth, async (req: AuthRequest, res) => {
  const [branding] = await db.select({ deployMode: brandingSettingsTable.deployMode })
    .from(brandingSettingsTable).where(eq(brandingSettingsTable.userId, req.userId!)).limit(1);

  res.json({
    deployMode: branding?.deployMode ?? "cloud",
    profiles: [
      { id: "local", name: "Local Desktop", description: "Data stays on your machine, no cloud sync", icon: "monitor" },
      { id: "cloud", name: "Cloud Connected", description: "Sync to cloud, access from anywhere", icon: "cloud" },
      { id: "enterprise", name: "Self-Hosted Enterprise", description: "Deploy on your own infrastructure", icon: "server" },
    ],
  });
});

export default router;
