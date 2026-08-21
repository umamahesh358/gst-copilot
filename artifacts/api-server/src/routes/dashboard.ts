import { Router } from "express";
import { db } from "@workspace/db";
import { invoicesTable, productsTable, transactionsTable, activityLogTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { calculateGstSummary, getAggregateGstSplit } from "../lib/gst-calculator";

const router = Router();

router.get("/dashboard/summary", requireAuth, async (req: AuthRequest, res) => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  // BUG-07 fix: Filter by current financial year to avoid loading entire DB
  const fyStart = now.getMonth() >= 3
    ? new Date(now.getFullYear(), 3, 1)   // Apr of current year
    : new Date(now.getFullYear() - 1, 3, 1); // Apr of last year

  const [allInvoices, allProducts, allTransactions] = await Promise.all([
    db.select().from(invoicesTable).where(and(
      eq(invoicesTable.userId, req.userId!),
      gte(invoicesTable.createdAt, fyStart)
    )),
    db.select().from(productsTable).where(and(
      eq(productsTable.userId, req.userId!),
      eq(productsTable.isDeleted, false)
    )),
    db.select().from(transactionsTable).where(and(
      eq(transactionsTable.userId, req.userId!),
      gte(transactionsTable.date, fyStart.toISOString().split("T")[0])
    )),
  ]);

  // ── Revenue (this month vs last month) ──────────────────────────────────────
  // BUG-14 fix: Use paidAt date (when payment happened) instead of createdAt (when record was created)
  const thisMonthInvoices = allInvoices.filter(i => i.paidAt && new Date(i.paidAt) >= monthStart);
  const paidThisMonth = thisMonthInvoices.filter(i => i.status === "paid");
  const totalRevenue = paidThisMonth.reduce((s, i) => s + parseFloat(i.totalAmount), 0);

  const lastMonthPaid = allInvoices.filter(i =>
    i.status === "paid" &&
    i.paidAt &&
    new Date(i.paidAt) >= lastMonthStart &&
    new Date(i.paidAt) <= lastMonthEnd
  );
  const lastMonthRevenue = lastMonthPaid.reduce((s, i) => s + parseFloat(i.totalAmount), 0);
  const revenueGrowth = lastMonthRevenue > 0
    ? ((totalRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
    : 0;

  // ── Unpaid invoice amount (money customers owe you — NOT GST) ───────────────
  const unpaidInvoices = allInvoices.filter(i => i.status === "unpaid" || i.status === "overdue");
  const pendingAmount = unpaidInvoices.reduce((s, i) => s + parseFloat(i.totalAmount), 0);

  // ── GST Calculation (via gst-calculator service) ────────────────────────────
  // Uses full ITC eligibility engine: GSTIN validation, blocked credits (Section 17(5)),
  // and 2-year time limit for claims.
  const gstSummary = calculateGstSummary(allInvoices);

  // CGST / SGST / IGST split (based on seller/buyer state codes in GSTINs)
  const saleInvoices = allInvoices.filter(i => i.type !== "purchase");
  const gstSplit = getAggregateGstSplit(saleInvoices);

  // ── P&L from transactions ───────────────────────────────────────────────────
  const income = allTransactions.filter(t => t.type === "income").reduce((s, t) => s + parseFloat(t.amount), 0);
  const expenses = allTransactions.filter(t => t.type === "expense").reduce((s, t) => s + parseFloat(t.amount), 0);
  const netProfit = Math.max(0, income - expenses);
  const netLoss = Math.max(0, expenses - income);

  // ── Low stock ───────────────────────────────────────────────────────────────
  const lowStockProducts = allProducts.filter(p => p.stockQty <= p.lowStockThreshold);

  res.json({
    // Revenue
    totalRevenue,
    revenueGrowth,
    // Receivables (unpaid invoice totals — customer debt, NOT GST)
    pendingAmount,
    unpaidInvoicesCount: unpaidInvoices.length,
    // GST fields (from gst-calculator service with full eligibility rules)
    outputGst: gstSummary.outputGst,
    inputGst: gstSummary.inputGst,
    netGstPayable: gstSummary.netGstPayable,
    excessITC: gstSummary.excessITC,
    // ITC eligibility metadata
    blockedCreditAmount: gstSummary.blockedCreditAmount,
    expiredCreditAmount: gstSummary.expiredCreditAmount,
    eligiblePurchaseInvoices: gstSummary.eligiblePurchaseInvoices,
    ineligiblePurchaseInvoices: gstSummary.ineligiblePurchaseInvoices,
    // CGST / SGST / IGST breakdown of output GST
    gstSplit: {
      cgst: gstSplit.cgst,
      sgst: gstSplit.sgst,
      igst: gstSplit.igst,
    },
    // P&L
    netProfit,
    netLoss,
    totalExpenses: expenses,
    // Inventory & counts
    lowStockCount: lowStockProducts.length,
    totalInvoicesThisMonth: thisMonthInvoices.length,
    paidInvoicesCount: paidThisMonth.length,
  });
});

router.get("/dashboard/recent-activity", requireAuth, async (req: AuthRequest, res) => {
  const limit = parseInt(req.query.limit as string) || 10;
  const activities = await db.select().from(activityLogTable)
    .where(eq(activityLogTable.userId, req.userId!))
    .orderBy(sql`${activityLogTable.createdAt} DESC`)
    .limit(limit);

  res.json(activities.map(a => ({
    ...a,
    amount: a.amount ? parseFloat(a.amount) : undefined,
  })));
});

router.get("/dashboard/revenue-chart", requireAuth, async (req: AuthRequest, res) => {
  const months = parseInt(req.query.months as string) || 6;
  // BUG-08 fix: Single query instead of N sequential queries
  const chartStart = new Date();
  chartStart.setMonth(chartStart.getMonth() - months + 1);
  chartStart.setDate(1);
  const startDate = chartStart.toISOString().split("T")[0];
  const endDate = new Date().toISOString().split("T")[0];

  const allTx = await db.select().from(transactionsTable)
    .where(and(
      eq(transactionsTable.userId, req.userId!),
      gte(transactionsTable.date, startDate),
      lte(transactionsTable.date, endDate)
    ));

  const result = [];
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const year = date.getFullYear();
    const month = date.getMonth();
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);

    const monthTx = allTx.filter(t => {
      const d = new Date(t.date);
      return d >= monthStart && d <= monthEnd;
    });

    const revenue = monthTx.filter(t => t.type === "income").reduce((s, t) => s + parseFloat(t.amount), 0);
    const expenses = monthTx.filter(t => t.type === "expense").reduce((s, t) => s + parseFloat(t.amount), 0);

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
