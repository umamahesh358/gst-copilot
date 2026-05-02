import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, aiPromptLogsTable, invoicesTable, productsTable, transactionsTable, customersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { SendAiPromptBody } from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const FREE_PLAN_LIMIT = 3;

async function getBusinessContext(userId: number) {
  const [invoices, products, transactions, customers] = await Promise.all([
    db.select().from(invoicesTable).orderBy(sql`${invoicesTable.createdAt} DESC`).limit(50),
    db.select().from(productsTable).where(eq(productsTable.isDeleted, false)),
    db.select().from(transactionsTable).orderBy(sql`${transactionsTable.date} DESC`).limit(50),
    db.select().from(customersTable).limit(20),
  ]);

  const totalRevenue = invoices.filter(i => i.status === "paid").reduce((s, i) => s + parseFloat(i.totalAmount), 0);
  const unpaidInvoices = invoices.filter(i => i.status === "unpaid" || i.status === "overdue");
  const lowStockProducts = products.filter(p => p.stockQty <= p.lowStockThreshold);
  const totalIncome = transactions.filter(t => t.type === "income").reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalExpenses = transactions.filter(t => t.type === "expense").reduce((s, t) => s + parseFloat(t.amount), 0);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthInvoices = invoices.filter(i => i.createdAt >= monthStart);
  const thisMonthRevenue = thisMonthInvoices.filter(i => i.status === "paid").reduce((s, i) => s + parseFloat(i.totalAmount), 0);

  return {
    summary: {
      totalRevenue,
      totalIncome,
      totalExpenses,
      netProfit: totalIncome - totalExpenses,
      thisMonthRevenue,
      totalInvoices: invoices.length,
      unpaidCount: unpaidInvoices.length,
      unpaidAmount: unpaidInvoices.reduce((s, i) => s + parseFloat(i.totalAmount), 0),
      totalProducts: products.length,
      lowStockCount: lowStockProducts.length,
      totalCustomers: customers.length,
    },
    recentInvoices: invoices.slice(0, 10).map(i => ({
      number: i.invoiceNumber,
      customer: i.customerName,
      amount: parseFloat(i.totalAmount),
      status: i.status,
      date: i.createdAt,
    })),
    unpaidInvoices: unpaidInvoices.slice(0, 10).map(i => ({
      number: i.invoiceNumber,
      customer: i.customerName,
      amount: parseFloat(i.totalAmount),
      due: i.dueDate,
    })),
    lowStockProducts: lowStockProducts.map(p => ({
      name: p.name,
      qty: p.stockQty,
      threshold: p.lowStockThreshold,
    })),
    recentTransactions: transactions.slice(0, 10).map(t => ({
      type: t.type,
      category: t.category,
      description: t.description,
      amount: parseFloat(t.amount),
      date: t.date,
    })),
  };
}

function classifyIntent(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (lower.includes("profit") || lower.includes("loss") || lower.includes("earning")) return "profit_query";
  if (lower.includes("unpaid") || lower.includes("pending") || lower.includes("overdue")) return "unpaid_invoices";
  if (lower.includes("low stock") || lower.includes("inventory") || lower.includes("running out")) return "low_stock";
  if (lower.includes("revenue") || lower.includes("sales") || lower.includes("income")) return "revenue_query";
  if (lower.includes("expense") || lower.includes("cost") || lower.includes("spending")) return "expense_query";
  if (lower.includes("summar") || lower.includes("overview") || lower.includes("business")) return "business_summary";
  if (lower.includes("customer") || lower.includes("client")) return "customer_query";
  if (lower.includes("invoice")) return "invoice_query";
  return "general";
}

router.post("/ai/prompt", requireAuth, async (req: AuthRequest, res) => {
  const result = SendAiPromptBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation error", message: result.error.message });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Unauthorized", message: "User not found" });
    return;
  }

  const limit = user.plan === "pro" ? 999999 : FREE_PLAN_LIMIT;
  if (user.aiPromptsUsed >= limit) {
    res.status(403).json({
      error: "Limit reached",
      message: user.plan === "free"
        ? `You have used all ${FREE_PLAN_LIMIT} free AI prompts. Upgrade to Pro for unlimited access.`
        : "AI prompt limit reached.",
    });
    return;
  }

  const { prompt } = result.data;
  const intent = classifyIntent(prompt);
  const context = await getBusinessContext(req.userId!);

  const systemPrompt = `You are BizOS AI Assistant, a business intelligence assistant for Indian SMEs. You help business owners understand their business data.

Business data context:
${JSON.stringify(context, null, 2)}

Rules:
- Answer only based on the provided data
- Be concise and precise with numbers
- Format currency in INR (₹)
- If asked about actions (create invoice, delete), say "I can help you navigate to do that" but don't claim to do it yourself
- Keep responses brief and actionable
- For summaries, use bullet points`;

  let answer = "";
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 1024,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
    });
    answer = response.choices[0]?.message?.content ?? "I couldn't generate a response. Please try again.";
  } catch (err) {
    answer = "AI service temporarily unavailable. Here's what I found in your data:\n\n" +
      `Total Revenue: ₹${context.summary.totalRevenue.toLocaleString()}\n` +
      `Unpaid Invoices: ${context.summary.unpaidCount} (₹${context.summary.unpaidAmount.toLocaleString()})\n` +
      `Low Stock Items: ${context.summary.lowStockCount}`;
  }

  await db.update(usersTable)
    .set({ aiPromptsUsed: user.aiPromptsUsed + 1 })
    .where(eq(usersTable.id, req.userId!));

  await db.insert(aiPromptLogsTable).values({
    userId: req.userId!,
    prompt,
    intent,
    response: answer,
  });

  const remaining = Math.max(0, limit - (user.aiPromptsUsed + 1));
  res.json({
    answer,
    intent,
    data: context.summary,
    requiresConfirmation: false,
    promptsRemaining: user.plan === "pro" ? 999999 : remaining,
  });
});

router.get("/ai/history", requireAuth, async (req: AuthRequest, res) => {
  const limit = parseInt(req.query.limit as string) || 20;
  const logs = await db.select().from(aiPromptLogsTable)
    .where(eq(aiPromptLogsTable.userId, req.userId!))
    .orderBy(sql`${aiPromptLogsTable.createdAt} DESC`)
    .limit(limit);

  res.json(logs);
});

router.get("/ai/usage", requireAuth, async (req: AuthRequest, res) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Unauthorized", message: "User not found" });
    return;
  }

  const limit = user.plan === "pro" ? 999999 : FREE_PLAN_LIMIT;
  res.json({
    used: user.aiPromptsUsed,
    limit,
    remaining: Math.max(0, limit - user.aiPromptsUsed),
    plan: user.plan,
  });
});

export default router;
