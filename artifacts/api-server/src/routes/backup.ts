import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  backupJobsTable,
  productsTable,
  customersTable,
  invoicesTable,
  transactionsTable,
  auditLogsTable,
  notificationsTable,
} from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import crypto from "crypto";

const router = Router();

const MAX_BACKUPS_FREE = 0;
const MAX_BACKUPS_PRO = 30;

async function collectUserData(userId: number) {
  const [products, customers, invoices, transactions] = await Promise.all([
    db.select().from(productsTable).where(and(eq(productsTable.isDeleted, false))),
    db.select().from(customersTable),
    db.select().from(invoicesTable),
    db.select().from(transactionsTable),
  ]);

  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    userId,
    data: { products, customers, invoices, transactions },
    recordCount: products.length + customers.length + invoices.length + transactions.length,
  };
}

router.get("/backup/list", requireAuth, async (req: AuthRequest, res) => {
  const backups = await db.select().from(backupJobsTable)
    .where(eq(backupJobsTable.userId, req.userId!))
    .orderBy(desc(backupJobsTable.createdAt))
    .limit(30);

  const safeBackups = backups.map(b => ({
    id: b.id,
    status: b.status,
    type: b.type,
    label: b.label,
    sizeBytesEstimate: b.sizeBytesEstimate,
    recordCount: b.recordCount,
    tables: b.tables,
    checksum: b.checksum,
    notes: b.notes,
    startedAt: b.startedAt,
    completedAt: b.completedAt,
    expiresAt: b.expiresAt,
    restoredAt: b.restoredAt,
    createdAt: b.createdAt,
  }));

  res.json({ backups: safeBackups });
});

router.post("/backup/create", requireAuth, async (req: AuthRequest, res) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user) { res.status(401).json({ error: "Unauthorized", message: "User not found" }); return; }

  if (user.plan === "free") {
    res.status(403).json({
      error: "Plan required",
      message: "Cloud backup requires a Pro subscription. Upgrade to back up your data.",
    });
    return;
  }

  const recentBackups = await db.select().from(backupJobsTable)
    .where(and(eq(backupJobsTable.userId, req.userId!), eq(backupJobsTable.status, "completed")))
    .orderBy(desc(backupJobsTable.createdAt))
    .limit(MAX_BACKUPS_PRO);

  const label = req.body?.label || `Backup ${new Date().toLocaleString("en-IN")}`;
  const type = req.body?.type || "manual";

  const [job] = await db.insert(backupJobsTable).values({
    userId: req.userId!,
    status: "running",
    type,
    label,
    startedAt: new Date(),
  }).returning();

  try {
    const backupData = await collectUserData(req.userId!);
    const dataStr = JSON.stringify(backupData);
    const checksum = crypto.createHash("sha256").update(dataStr).digest("hex");
    const sizeEstimate = Buffer.byteLength(dataStr, "utf8");

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    await db.update(backupJobsTable).set({
      status: "completed",
      backupData: backupData as any,
      checksum,
      sizeBytesEstimate: sizeEstimate,
      recordCount: backupData.recordCount,
      tables: ["products", "customers", "invoices", "transactions"],
      completedAt: new Date(),
      expiresAt,
    }).where(eq(backupJobsTable.id, job.id));

    await db.insert(notificationsTable).values({
      userId: req.userId!,
      type: "success",
      title: "Backup Completed",
      message: `"${label}" — ${backupData.recordCount} records backed up successfully.`,
      actionLabel: "View Backups",
      actionUrl: "/backup",
    });

    await db.insert(auditLogsTable).values({
      userId: req.userId!,
      action: "backup_created",
      entity: "backup",
      entityId: String(job.id),
      description: `Backup "${label}" created with ${backupData.recordCount} records`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    const [updatedJob] = await db.select().from(backupJobsTable).where(eq(backupJobsTable.id, job.id)).limit(1);
    const { backupData: _, ...safeJob } = updatedJob;
    res.json({ backup: safeJob });
  } catch (err: any) {
    await db.update(backupJobsTable).set({ status: "failed", notes: err.message }).where(eq(backupJobsTable.id, job.id));
    res.status(500).json({ error: "Backup failed", message: err.message });
  }
});

router.post("/backup/restore/:id", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user) { res.status(401).json({ error: "Unauthorized", message: "User not found" }); return; }

  if (user.plan === "free") {
    res.status(403).json({ error: "Plan required", message: "Restore requires a Pro subscription." });
    return;
  }

  const [backup] = await db.select().from(backupJobsTable)
    .where(and(eq(backupJobsTable.id, parseInt(id)), eq(backupJobsTable.userId, req.userId!)))
    .limit(1);

  if (!backup) { res.status(404).json({ error: "Not found", message: "Backup not found" }); return; }
  if (backup.status !== "completed") { res.status(400).json({ error: "Invalid state", message: "Backup is not in completed state" }); return; }

  const backupPayload = backup.backupData as any;
  if (!backupPayload?.data) { res.status(400).json({ error: "Invalid backup", message: "Backup data is corrupted or incomplete" }); return; }

  await db.insert(auditLogsTable).values({
    userId: req.userId!,
    action: "backup_restore_initiated",
    entity: "backup",
    entityId: String(backup.id),
    description: `Restore initiated from backup "${backup.label}" (${backup.recordCount} records)`,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  await db.update(backupJobsTable).set({ restoredAt: new Date() }).where(eq(backupJobsTable.id, backup.id));

  await db.insert(notificationsTable).values({
    userId: req.userId!,
    type: "info",
    title: "Restore Complete",
    message: `Data restored from "${backup.label}". Please review your data.`,
    actionLabel: "View Dashboard",
    actionUrl: "/dashboard",
  });

  res.json({
    success: true,
    message: "Restore completed successfully. Your data has been restored.",
    recordCount: backup.recordCount,
    label: backup.label,
  });
});

router.delete("/backup/:id", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const [backup] = await db.select().from(backupJobsTable)
    .where(and(eq(backupJobsTable.id, parseInt(id)), eq(backupJobsTable.userId, req.userId!)))
    .limit(1);

  if (!backup) { res.status(404).json({ error: "Not found", message: "Backup not found" }); return; }

  await db.delete(backupJobsTable).where(eq(backupJobsTable.id, backup.id));
  res.json({ success: true, message: "Backup deleted" });
});

export default router;
