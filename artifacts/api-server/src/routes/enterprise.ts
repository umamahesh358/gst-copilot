import { Router } from "express";
import { db } from "@workspace/db";
import {
  enterpriseSettingsTable, auditLogsTable, devicesTable,
  usersTable, subscriptionsTable,
} from "@workspace/db";
import { eq, desc, and, count } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/enterprise/settings", requireAuth, async (req: AuthRequest, res) => {
  let [settings] = await db.select().from(enterpriseSettingsTable)
    .where(eq(enterpriseSettingsTable.userId, req.userId!));

  if (!settings) {
    [settings] = await db.insert(enterpriseSettingsTable).values({ userId: req.userId! }).returning();
  }
  res.json({ settings });
});

router.put("/enterprise/settings", requireAuth, async (req: AuthRequest, res) => {
  const {
    dataRetentionDays, sessionTimeoutMinutes, maxDevices, requireMfa,
    allowedIpRanges, apiRateLimitPerMinute, auditLevel, exportPolicy,
    deletionPolicy, complianceMode, alertEmail,
  } = req.body;

  let [settings] = await db.select().from(enterpriseSettingsTable)
    .where(eq(enterpriseSettingsTable.userId, req.userId!));

  if (!settings) {
    [settings] = await db.insert(enterpriseSettingsTable).values({ userId: req.userId!, ...req.body }).returning();
  } else {
    [settings] = await db.update(enterpriseSettingsTable).set({
      dataRetentionDays, sessionTimeoutMinutes, maxDevices,
      requireMfa: requireMfa !== undefined ? (requireMfa ? 1 : 0) : undefined,
      allowedIpRanges, apiRateLimitPerMinute, auditLevel,
      exportPolicy, deletionPolicy, complianceMode, alertEmail,
      updatedAt: new Date(),
    }).where(eq(enterpriseSettingsTable.userId, req.userId!)).returning();
  }

  await db.insert(auditLogsTable).values({
    userId: req.userId!,
    action: "update",
    entity: "enterprise_settings",
    entityId: String(settings.id),
    description: "Updated enterprise governance settings",
  });
  res.json({ settings });
});

router.get("/enterprise/overview", requireAuth, async (req: AuthRequest, res) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  const devices = await db.select().from(devicesTable).where(eq(devicesTable.userId, req.userId!));
  const recentAudit = await db.select().from(auditLogsTable)
    .where(eq(auditLogsTable.userId, req.userId!))
    .orderBy(desc(auditLogsTable.createdAt)).limit(10);
  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, req.userId!));

  res.json({
    overview: {
      user: { id: user.id, name: user.name, email: user.email, plan: user.plan },
      devices: { total: devices.length, trusted: devices.filter(d => d.trusted).length },
      subscription: sub ?? null,
      recentActivity: recentAudit.length,
    },
  });
});

router.get("/enterprise/security-events", requireAuth, async (req: AuthRequest, res) => {
  const events = await db.select().from(auditLogsTable).where(
    and(
      eq(auditLogsTable.userId, req.userId!),
      eq(auditLogsTable.status, "failed")
    )
  ).orderBy(desc(auditLogsTable.createdAt)).limit(50);
  res.json({ events });
});

router.get("/enterprise/metrics", requireAuth, async (req: AuthRequest, res) => {
  const auditRows = await db.select().from(auditLogsTable).where(eq(auditLogsTable.userId, req.userId!));
  const devices = await db.select().from(devicesTable).where(eq(devicesTable.userId, req.userId!));

  const actionCounts: Record<string, number> = {};
  const entityCounts: Record<string, number> = {};
  for (const log of auditRows) {
    actionCounts[log.action] = (actionCounts[log.action] ?? 0) + 1;
    entityCounts[log.entity] = (entityCounts[log.entity] ?? 0) + 1;
  }

  res.json({
    metrics: {
      totalAuditEvents: auditRows.length,
      totalDevices: devices.length,
      trustedDevices: devices.filter(d => d.trusted).length,
      topActions: Object.entries(actionCounts).sort((a, b) => b[1] - a[1]).slice(0, 5),
      topEntities: Object.entries(entityCounts).sort((a, b) => b[1] - a[1]).slice(0, 5),
    },
  });
});

router.get("/enterprise/access-review", requireAuth, async (req: AuthRequest, res) => {
  const devices = await db.select().from(devicesTable).where(eq(devicesTable.userId, req.userId!));
  const recentAudit = await db.select().from(auditLogsTable)
    .where(eq(auditLogsTable.userId, req.userId!))
    .orderBy(desc(auditLogsTable.createdAt)).limit(20);
  res.json({
    devices: devices.map(d => ({ id: d.id, deviceName: d.deviceName, trusted: d.trusted, lastSeen: d.lastSeen })),
    recentAccess: recentAudit,
  });
});

export default router;
