import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  devicesTable,
  auditLogsTable,
  notificationsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router = Router();

const DEVICE_LIMITS: Record<string, number> = {
  free: 1,
  pro: 3,
  pro_monthly: 3,
  pro_yearly: 5,
};

router.get("/devices", requireAuth, async (req: AuthRequest, res) => {
  const devices = await db.select().from(devicesTable)
    .where(and(eq(devicesTable.userId, req.userId!), eq(devicesTable.isRevoked, false)));

  res.json({ devices });
});

router.post("/devices/register", requireAuth, async (req: AuthRequest, res) => {
  const { deviceId, name, platform: rawPlatform, browserInfo } = req.body || {};
  if (!deviceId || !name) {
    res.status(400).json({ error: "Validation error", message: "deviceId and name are required" });
    return;
  }
  const platform = rawPlatform || "web";

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user) { res.status(401).json({ error: "Unauthorized", message: "User not found" }); return; }

  const [existing] = await db.select().from(devicesTable)
    .where(and(eq(devicesTable.deviceId, deviceId), eq(devicesTable.userId, req.userId!)))
    .limit(1);

  if (existing) {
    if (existing.isRevoked) {
      res.status(403).json({ error: "Device revoked", message: "This device has been revoked. Contact support." });
      return;
    }
    await db.update(devicesTable).set({ lastSeenAt: new Date(), browserInfo: browserInfo || existing.browserInfo })
      .where(eq(devicesTable.id, existing.id));
    const [updated] = await db.select().from(devicesTable).where(eq(devicesTable.id, existing.id)).limit(1);
    res.json({ device: updated, isNew: false });
    return;
  }

  const activeDevices = await db.select().from(devicesTable)
    .where(and(eq(devicesTable.userId, req.userId!), eq(devicesTable.isRevoked, false)));

  const limit = DEVICE_LIMITS[user.plan] || 1;
  if (activeDevices.length >= limit) {
    res.status(403).json({
      error: "Device limit reached",
      message: `Your ${user.plan} plan allows up to ${limit} device(s). Revoke an existing device or upgrade your plan.`,
      limit,
      current: activeDevices.length,
    });
    return;
  }

  const ipAddress = req.ip || req.connection.remoteAddress || "unknown";
  const [device] = await db.insert(devicesTable).values({
    userId: req.userId!,
    deviceId,
    name,
    platform,
    browserInfo,
    ipAddress,
    isRevoked: false,
    isTrusted: true,
    lastSeenAt: new Date(),
    registeredAt: new Date(),
  }).returning();

  await db.insert(auditLogsTable).values({
    userId: req.userId!,
    action: "device_registered",
    entity: "device",
    entityId: String(device.id),
    description: `New device registered: ${name} (${platform})`,
    ipAddress,
    userAgent: req.headers["user-agent"],
    deviceId,
  });

  res.json({ device, isNew: true });
});

router.patch("/devices/:id/revoke", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const [device] = await db.select().from(devicesTable)
    .where(and(eq(devicesTable.id, parseInt(id)), eq(devicesTable.userId, req.userId!)))
    .limit(1);

  if (!device) { res.status(404).json({ error: "Not found", message: "Device not found" }); return; }

  await db.update(devicesTable).set({ isRevoked: true, revokedAt: new Date() })
    .where(eq(devicesTable.id, device.id));

  await db.insert(auditLogsTable).values({
    userId: req.userId!,
    action: "device_revoked",
    entity: "device",
    entityId: String(device.id),
    description: `Device revoked: ${device.name}`,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  await db.insert(notificationsTable).values({
    userId: req.userId!,
    type: "warning",
    title: "Device Revoked",
    message: `"${device.name}" has been removed from your account.`,
  });

  res.json({ success: true, message: "Device revoked successfully" });
});

router.delete("/devices/:id", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const [device] = await db.select().from(devicesTable)
    .where(and(eq(devicesTable.id, parseInt(id)), eq(devicesTable.userId, req.userId!)))
    .limit(1);

  if (!device) { res.status(404).json({ error: "Not found", message: "Device not found" }); return; }
  await db.delete(devicesTable).where(eq(devicesTable.id, device.id));
  res.json({ success: true, message: "Device removed" });
});

router.post("/devices/validate", requireAuth, async (req: AuthRequest, res) => {
  const { deviceId } = req.body;
  if (!deviceId) { res.status(400).json({ error: "Validation error", message: "deviceId is required" }); return; }

  const [device] = await db.select().from(devicesTable)
    .where(and(eq(devicesTable.deviceId, deviceId), eq(devicesTable.userId, req.userId!)))
    .limit(1);

  if (!device) { res.json({ valid: false, reason: "Device not registered" }); return; }
  if (device.isRevoked) { res.json({ valid: false, reason: "Device has been revoked" }); return; }

  await db.update(devicesTable).set({ lastSeenAt: new Date() }).where(eq(devicesTable.id, device.id));
  res.json({ valid: true, device: { id: device.id, name: device.name, platform: device.platform, lastSeenAt: device.lastSeenAt } });
});

export default router;
