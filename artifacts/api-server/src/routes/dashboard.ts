import { Router } from "express";
import { db } from "@workspace/db";
import { invoicesTable, productsTable, transactionsTable, activityLogTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/dashboard/summary", requireAuth, async (req: AuthRequest, res) => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];

  const [allInvoices, allProducts, allTransactions] = await Promise.all([
    db.select().from(invoicesTable),
    db.select().from(productsTable).where(eq(productsTable.isDeleted, false)),
    db.select().from(transactionsTable),
  ]);

  const thisMonthInvoices = allInvoices.filter(i => i.createdAt >= new Date(monthStart));
  const paidThisMonth = thisMonthInvoices.filter(i => i.status === "paid");
  const totalRevenue = paidThisMonth.reduce((s, i) => s + parseFloat(i.totalAmount), 0);

  const lastMonthPaid = allInvoices.filter(i =>
    i.status === "paid" && i.createdAt >= new Date(lastMonthStart) && i.createdAt <= new Date(lastMonthEnd)
  );
  const lastMonthRevenue = lastMonthPaid.reduce((s, i) => s + parseFloat(i.totalAmount), 0);
  const revenueGrowth = lastMonthRevenue > 0
    ? ((totalRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
    : 0;

  const unpaidInvoices = allInvoices.filter(i => i.status === "unpaid" || i.status === "overdue");
  const pendingPayments = unpaidInvoices.reduce((s, i) => s + parseFloat(i.totalAmount), 0);

  const lowStockProducts = allProducts.filter(p => p.stockQty <= p.lowStockThreshold);

  const income = allTransactions.filter(t => t.type === "income").reduce((s, t) => s + parseFloat(t.amount), 0);
  const expenses = allTransactions.filter(t => t.type === "expense").reduce((s, t) => s + parseFloat(t.amount), 0);
  const netProfit = Math.max(0, income - expenses);
  const netLoss = Math.max(0, expenses - income);

  res.json({
    totalRevenue,
    revenueGrowth,
    pendingPayments,
    unpaidInvoicesCount: unpaidInvoices.length,
    lowStockCount: lowStockProducts.length,
    netProfit,
    netLoss,
    totalExpenses: expenses,
    totalInvoicesThisMonth: thisMonthInvoices.length,
    paidInvoicesCount: paidThisMonth.length,
  });
});

router.get("/dashboard/recent-activity", requireAuth, async (req: AuthRequest, res) => {
  const limit = parseInt(req.query.limit as string) || 10;
  const activities = await db.select().from(activityLogTable)
    .orderBy(sql`${activityLogTable.createdAt} DESC`)
    .limit(limit);

  res.json(activities.map(a => ({
    ...a,
    amount: a.amount ? parseFloat(a.amount) : undefined,
  })));
});

router.get("/dashboard/revenue-chart", requireAuth, async (req: AuthRequest, res) => {
  const months = parseInt(req.query.months as string) || 6;
  const result = [];

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const year = date.getFullYear();
    const month = date.getMonth();
    const start = new Date(year, month, 1).toISOString().split("T")[0];
    const end = new Date(year, month + 1, 0).toISOString().split("T")[0];

    const transactions = await db.select().from(transactionsTable)
      .where(and(gte(transactionsTable.date, start), lte(transactionsTable.date, end)));

    const revenue = transactions.filter(t => t.type === "income").reduce((s, t) => s + parseFloat(t.amount), 0);
    const expenses = transactions.filter(t => t.type === "expense").reduce((s, t) => s + parseFloat(t.amount), 0);

    result.push({
      month: date.toLocaleString("default", { month: "short", year: "numeric" }),
      revenue,
      expenses,
      profit: revenue - expenses,
    });
  }

  res.json(result);
});

export default router;
