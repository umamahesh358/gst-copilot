import { Router } from "express";
import { db } from "@workspace/db";
import {
  invoicesTable,
  invoiceItemsTable,
  transactionsTable,
  productsTable,
  expensesTable,
} from "@workspace/db";
import { eq, desc, gte, lte, and, sql, sum, count } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/analytics/revenue", requireAuth, async (req: AuthRequest, res) => {
  const months = parseInt(req.query.months as string) || 6;
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  const invoices = await db
    .select({
      month: sql<string>`to_char(${invoicesTable.createdAt}, 'YYYY-MM')`,
      revenue: sum(invoicesTable.totalAmount),
      count: count(invoicesTable.id),
    })
    .from(invoicesTable)
    .where(gte(invoicesTable.createdAt, since))
    .groupBy(sql`to_char(${invoicesTable.createdAt}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${invoicesTable.createdAt}, 'YYYY-MM')`);

  const expenses = await db
    .select({
      month: sql<string>`to_char(${expensesTable.createdAt}, 'YYYY-MM')`,
      total: sum(expensesTable.totalAmount),
    })
    .from(expensesTable)
    .where(
      and(
        eq(expensesTable.userId, req.userId!),
        gte(expensesTable.createdAt, since),
        eq(expensesTable.isDeleted, false)
      )
    )
    .groupBy(sql`to_char(${expensesTable.createdAt}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${expensesTable.createdAt}, 'YYYY-MM')`);

  const expenseMap = Object.fromEntries(
    expenses.map((e) => [e.month, parseFloat(e.total ?? "0")])
  );

  const result = invoices.map((row) => ({
    month: row.month,
    revenue: parseFloat(row.revenue ?? "0"),
    invoiceCount: Number(row.count),
    expenses: expenseMap[row.month] ?? 0,
    profit:
      parseFloat(row.revenue ?? "0") - (expenseMap[row.month] ?? 0),
  }));

  res.json({ data: result });
});

router.get("/analytics/summary", requireAuth, async (req: AuthRequest, res) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const [currentRevenue] = await db
    .select({ total: sum(invoicesTable.totalAmount), cnt: count() })
    .from(invoicesTable)
    .where(gte(invoicesTable.createdAt, startOfMonth));

  const [prevRevenue] = await db
    .select({ total: sum(invoicesTable.totalAmount) })
    .from(invoicesTable)
    .where(
      and(
        gte(invoicesTable.createdAt, startOfPrevMonth),
        lte(invoicesTable.createdAt, endOfPrevMonth)
      )
    );

  const [currentExpenses] = await db
    .select({ total: sum(expensesTable.totalAmount) })
    .from(expensesTable)
    .where(
      and(
        eq(expensesTable.userId, req.userId!),
        gte(expensesTable.createdAt, startOfMonth),
        eq(expensesTable.isDeleted, false)
      )
    );

  const [pendingInvoices] = await db
    .select({ cnt: count(), total: sum(invoicesTable.totalAmount) })
    .from(invoicesTable)
    .where(eq(invoicesTable.status, "pending"));

  const currentRev = parseFloat(currentRevenue?.total ?? "0");
  const prevRev = parseFloat(prevRevenue?.total ?? "0");
  const revChange = prevRev > 0 ? ((currentRev - prevRev) / prevRev) * 100 : 0;

  res.json({
    currentMonthRevenue: currentRev,
    prevMonthRevenue: prevRev,
    revenueChange: Math.round(revChange * 10) / 10,
    currentMonthInvoices: Number(currentRevenue?.cnt ?? 0),
    currentMonthExpenses: parseFloat(currentExpenses?.total ?? "0"),
    currentMonthProfit:
      currentRev - parseFloat(currentExpenses?.total ?? "0"),
    pendingInvoicesCount: Number(pendingInvoices?.cnt ?? 0),
    pendingInvoicesAmount: parseFloat(pendingInvoices?.total ?? "0"),
  });
});

router.get("/analytics/top-products", requireAuth, async (_req, res) => {
  const rows = await db
    .select({
      productName: invoiceItemsTable.productName,
      totalQty: sum(invoiceItemsTable.quantity),
      totalRevenue: sum(invoiceItemsTable.total),
      orderCount: count(invoiceItemsTable.id),
    })
    .from(invoiceItemsTable)
    .groupBy(invoiceItemsTable.productName)
    .orderBy(desc(sum(invoiceItemsTable.total)))
    .limit(10);

  res.json({
    data: rows.map((r) => ({
      name: r.productName,
      qty: Number(r.totalQty ?? 0),
      revenue: parseFloat(r.totalRevenue ?? "0"),
      orders: Number(r.orderCount ?? 0),
    })),
  });
});

router.get("/analytics/low-stock", requireAuth, async (_req, res) => {
  const products = await db
    .select()
    .from(productsTable)
    .where(
      and(
        eq(productsTable.isDeleted, false),
        sql`${productsTable.stockQty} <= ${productsTable.lowStockThreshold}`
      )
    )
    .orderBy(productsTable.stockQty)
    .limit(20);

  res.json({ data: products });
});

router.get("/analytics/gst-summary", requireAuth, async (req: AuthRequest, res) => {
  const months = parseInt(req.query.months as string) || 3;
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  const rows = await db
    .select({
      month: sql<string>`to_char(${invoicesTable.createdAt}, 'YYYY-MM')`,
      totalGst: sum(invoicesTable.gstAmount),
      totalRevenue: sum(invoicesTable.totalAmount),
      invoiceCount: count(invoicesTable.id),
    })
    .from(invoicesTable)
    .where(gte(invoicesTable.createdAt, since))
    .groupBy(sql`to_char(${invoicesTable.createdAt}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${invoicesTable.createdAt}, 'YYYY-MM')`);

  res.json({
    data: rows.map((r) => ({
      month: r.month,
      gst: parseFloat(r.totalGst ?? "0"),
      revenue: parseFloat(r.totalRevenue ?? "0"),
      invoices: Number(r.invoiceCount ?? 0),
    })),
  });
});

router.get("/analytics/expense-breakdown", requireAuth, async (req: AuthRequest, res) => {
  const rows = await db
    .select({
      category: expensesTable.category,
      total: sum(expensesTable.totalAmount),
      count: count(expensesTable.id),
    })
    .from(expensesTable)
    .where(
      and(eq(expensesTable.userId, req.userId!), eq(expensesTable.isDeleted, false))
    )
    .groupBy(expensesTable.category)
    .orderBy(desc(sum(expensesTable.totalAmount)));

  res.json({
    data: rows.map((r) => ({
      category: r.category ?? "general",
      total: parseFloat(r.total ?? "0"),
      count: Number(r.count ?? 0),
    })),
  });
});

export default router;
