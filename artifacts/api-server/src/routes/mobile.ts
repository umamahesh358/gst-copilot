import { Router } from "express";
import { db } from "@workspace/db";
import {
  invoicesTable, productsTable, notificationsTable,
  approvalRequestsTable, tasksTable,
} from "@workspace/db";
import { eq, desc, and, lte } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/mobile/summary", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;

  const [invoices, products, notifications, pendingApprovals, openTasks] = await Promise.all([
    db.select().from(invoicesTable).orderBy(desc(invoicesTable.createdAt)).limit(5),
    db.select().from(productsTable).where(eq(productsTable.isDeleted, false)).limit(200),
    db.select().from(notificationsTable)
      .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.isRead, false)))
      .limit(5),
    db.select().from(approvalRequestsTable)
      .where(and(eq(approvalRequestsTable.requestedByUserId, userId), eq(approvalRequestsTable.status, "pending")))
      .limit(5),
    db.select().from(tasksTable)
      .where(and(eq(tasksTable.userId, userId), eq(tasksTable.status, "open")))
      .limit(5),
  ]);

  const totalRevenue = invoices
    .filter(i => i.status === "paid")
    .reduce((s, i) => s + parseFloat(i.totalAmount ?? "0"), 0);
  const unpaidCount = invoices.filter(i => i.status === "unpaid" || i.status === "pending").length;
  const lowStock = products.filter(p => p.stockQty <= p.lowStockThreshold).length;

  res.json({
    summary: {
      recentInvoices: invoices.slice(0, 3).map(i => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        totalAmount: i.totalAmount,
        status: i.status,
        customerName: i.customerName,
      })),
      stats: {
        totalRevenue,
        unpaidInvoices: unpaidCount,
        lowStockItems: lowStock,
        pendingApprovals: pendingApprovals.length,
        openTasks: openTasks.length,
      },
      unreadNotifications: notifications.length,
      urgentTasks: openTasks.filter(t => t.priority === "urgent").length,
    },
  });
});

router.get("/mobile/invoices", requireAuth, async (_req: AuthRequest, res) => {
  const items = await db.select().from(invoicesTable)
    .orderBy(desc(invoicesTable.createdAt)).limit(20);
  res.json({
    invoices: items.map(i => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      customerName: i.customerName,
      totalAmount: i.totalAmount,
      status: i.status,
      dueDate: i.dueDate,
    })),
  });
});

router.get("/mobile/approvals", requireAuth, async (req: AuthRequest, res) => {
  const items = await db.select().from(approvalRequestsTable).where(
    and(
      eq(approvalRequestsTable.requestedByUserId, req.userId!),
      eq(approvalRequestsTable.status, "pending")
    )
  ).orderBy(desc(approvalRequestsTable.createdAt)).limit(10);
  res.json({ approvals: items });
});

router.get("/mobile/tasks", requireAuth, async (req: AuthRequest, res) => {
  const items = await db.select().from(tasksTable).where(
    and(eq(tasksTable.userId, req.userId!), eq(tasksTable.status, "open"))
  ).orderBy(desc(tasksTable.createdAt)).limit(10);
  res.json({ tasks: items });
});

router.get("/mobile/notifications", requireAuth, async (req: AuthRequest, res) => {
  const items = await db.select().from(notificationsTable).where(
    eq(notificationsTable.userId, req.userId!)
  ).orderBy(desc(notificationsTable.createdAt)).limit(20);
  res.json({ notifications: items });
});

router.get("/mobile/stock-alerts", requireAuth, async (_req: AuthRequest, res) => {
  const products = await db.select().from(productsTable)
    .where(eq(productsTable.isDeleted, false));
  const alerts = products.filter(p => p.stockQty <= p.lowStockThreshold);
  res.json({
    alerts: alerts.map(p => ({
      id: p.id,
      name: p.name,
      stockQty: p.stockQty,
      lowStockThreshold: p.lowStockThreshold,
      sku: p.sku,
    })),
  });
});

export default router;
