import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/notifications", requireAuth, async (req: AuthRequest, res) => {
  const limit = parseInt(req.query.limit as string) || 30;
  const unreadOnly = req.query.unread === "true";

  const conditions = unreadOnly
    ? and(eq(notificationsTable.userId, req.userId!), eq(notificationsTable.isRead, false))
    : eq(notificationsTable.userId, req.userId!);

  const notifications = await db.select().from(notificationsTable)
    .where(conditions)
    .orderBy(desc(notificationsTable.createdAt))
    .limit(limit);

  const [unreadCountResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notificationsTable)
    .where(and(eq(notificationsTable.userId, req.userId!), eq(notificationsTable.isRead, false)));

  res.json({ notifications, unreadCount: unreadCountResult?.count || 0 });
});

router.patch("/notifications/:id/read", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params as Record<string, string>;
  const [notif] = await db.select().from(notificationsTable)
    .where(and(eq(notificationsTable.id, parseInt(id)), eq(notificationsTable.userId, req.userId!)))
    .limit(1);

  if (!notif) { res.status(404).json({ error: "Not found", message: "Notification not found" }); return; }

  await db.update(notificationsTable).set({ isRead: true, readAt: new Date() })
    .where(eq(notificationsTable.id, notif.id));

  res.json({ success: true });
});

router.patch("/notifications/read-all", requireAuth, async (req: AuthRequest, res) => {
  await db.update(notificationsTable)
    .set({ isRead: true, readAt: new Date() })
    .where(and(eq(notificationsTable.userId, req.userId!), eq(notificationsTable.isRead, false)));

  res.json({ success: true, message: "All notifications marked as read" });
});

router.delete("/notifications/:id", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params as Record<string, string>;
  await db.delete(notificationsTable)
    .where(and(eq(notificationsTable.id, parseInt(id)), eq(notificationsTable.userId, req.userId!)));
  res.json({ success: true });
});

export default router;
