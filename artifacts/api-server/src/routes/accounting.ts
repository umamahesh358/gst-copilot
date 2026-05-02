import { Router } from "express";
import { db } from "@workspace/db";
import { transactionsTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { CreateTransactionBody } from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/accounting/transactions", requireAuth, async (req: AuthRequest, res) => {
  const type = req.query.type as string | undefined;
  const startDate = req.query.startDate as string | undefined;
  const endDate = req.query.endDate as string | undefined;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (type) conditions.push(eq(transactionsTable.type, type));
  if (startDate) conditions.push(gte(transactionsTable.date, startDate));
  if (endDate) conditions.push(lte(transactionsTable.date, endDate));

  const all = await db.select().from(transactionsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(sql`${transactionsTable.date} DESC`);

  const total = all.length;
  const transactions = all.slice(offset, offset + limit).map(t => ({
    ...t,
    amount: parseFloat(t.amount),
  }));

  const totalIncome = all.filter(t => t.type === "income").reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalExpenses = all.filter(t => t.type === "expense").reduce((s, t) => s + parseFloat(t.amount), 0);

  res.json({ transactions, total, page, limit, totalIncome, totalExpenses });
});

router.post("/accounting/transactions", requireAuth, async (req: AuthRequest, res) => {
  const result = CreateTransactionBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation error", message: result.error.message });
    return;
  }

  const data = result.data;
  const [transaction] = await db.insert(transactionsTable).values({
    type: data.type,
    category: data.category,
    description: data.description,
    amount: String(data.amount),
    date: data.date,
    invoiceId: data.invoiceId,
    referenceNumber: data.referenceNumber,
  }).returning();

  res.status(201).json({ ...transaction, amount: parseFloat(transaction.amount) });
});

router.get("/accounting/summary", requireAuth, async (req: AuthRequest, res) => {
  const period = (req.query.period as string) || "month";

  let startDate: string;
  const now = new Date();
  if (period === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    startDate = d.toISOString().split("T")[0];
  } else if (period === "quarter") {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 3);
    startDate = d.toISOString().split("T")[0];
  } else if (period === "year") {
    const d = new Date(now);
    d.setFullYear(d.getFullYear() - 1);
    startDate = d.toISOString().split("T")[0];
  } else {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 1);
    startDate = d.toISOString().split("T")[0];
  }

  const endDate = now.toISOString().split("T")[0];
  const transactions = await db.select().from(transactionsTable)
    .where(and(gte(transactionsTable.date, startDate), lte(transactionsTable.date, endDate)));

  const income = transactions.filter(t => t.type === "income");
  const expenses = transactions.filter(t => t.type === "expense");
  const totalIncome = income.reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalExpenses = expenses.reduce((s, t) => s + parseFloat(t.amount), 0);
  const netProfit = totalIncome - totalExpenses;
  const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

  const expenseByCategory = new Map<string, number>();
  expenses.forEach(t => {
    expenseByCategory.set(t.category, (expenseByCategory.get(t.category) || 0) + parseFloat(t.amount));
  });

  const incomeByCategory = new Map<string, number>();
  income.forEach(t => {
    incomeByCategory.set(t.category, (incomeByCategory.get(t.category) || 0) + parseFloat(t.amount));
  });

  res.json({
    period,
    totalIncome,
    totalExpenses,
    netProfit,
    profitMargin,
    topExpenseCategories: Array.from(expenseByCategory.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, amount]) => ({ category, amount })),
    incomeBreakdown: Array.from(incomeByCategory.entries())
      .map(([category, amount]) => ({ category, amount })),
  });
});

export default router;
