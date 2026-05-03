import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  aiPromptLogsTable,
  invoicesTable,
  productsTable,
  transactionsTable,
  customersTable,
  subscriptionsTable,
  auditLogsTable,
  notificationsTable,
} from "@workspace/db";
import { eq, sql, desc, and } from "drizzle-orm";
import { SendAiPromptBody } from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const FREE_PLAN_LIMIT = 10;

interface ActionResult {
  executed: boolean;
  requiresConfirmation: boolean;
  confirmationMessage?: string;
  actionType?: string;
  actionData?: unknown;
}

type Intent =
  | "profit_query" | "unpaid_invoices" | "low_stock" | "revenue_query"
  | "expense_query" | "business_summary" | "customer_query" | "invoice_query"
  | "subscription_status" | "backup_request" | "upgrade_request" | "general";

function classifyIntent(prompt: string): Intent {
  const lower = prompt.toLowerCase();
  if (lower.includes("profit") || lower.includes("loss") || lower.includes("earning")) return "profit_query";
  if (lower.includes("unpaid") || lower.includes("pending") || lower.includes("overdue")) return "unpaid_invoices";
  if (lower.includes("low stock") || lower.includes("inventory") || lower.includes("running out")) return "low_stock";
  if (lower.includes("revenue") || lower.includes("sales") || lower.includes("income")) return "revenue_query";
  if (lower.includes("expense") || lower.includes("cost") || lower.includes("spending")) return "expense_query";
  if (lower.includes("subscription") || lower.includes("plan") || lower.includes("billing") || lower.includes("pro")) return "subscription_status";
  if (lower.includes("backup") || lower.includes("restore") || lower.includes("cloud save")) return "backup_request";
  if (lower.includes("upgrade") || lower.includes("buy") || lower.includes("purchase plan")) return "upgrade_request";
  if (lower.includes("summar") || lower.includes("overview") || lower.includes("business")) return "business_summary";
  if (lower.includes("customer") || lower.includes("client")) return "customer_query";
  if (lower.includes("invoice")) return "invoice_query";
  return "general";
}

async function getSubscriptionContext(userId: number) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const [sub] = await db.select().from(subscriptionsTable)
    .where(and(eq(subscriptionsTable.userId, userId), eq(subscriptionsTable.status, "active")))
    .orderBy(desc(subscriptionsTable.createdAt))
    .limit(1);
  return {
    plan: user?.plan || "free",
    subscription: sub ? {
      plan: sub.plan,
      status: sub.status,
      startDate: sub.startDate,
      endDate: sub.endDate,
      renewalDate: sub.renewalDate,
    } : null,
  };
}

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
  const thisMonthInvoices = invoices.filter(i => new Date(i.createdAt) >= monthStart);
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

async function resolveAction(intent: Intent, userId: number): Promise<ActionResult> {
  switch (intent) {
    case "subscription_status": {
      const ctx = await getSubscriptionContext(userId);
      return {
        executed: true,
        requiresConfirmation: false,
        actionType: "subscription_status",
        actionData: ctx,
      };
    }
    case "backup_request": {
      return {
        executed: false,
        requiresConfirmation: true,
        confirmationMessage: "Would you like me to create a cloud backup of your data now? This will save all your invoices, products, customers, and transactions.",
        actionType: "create_backup",
      };
    }
    case "upgrade_request": {
      return {
        executed: false,
        requiresConfirmation: true,
        confirmationMessage: "Would you like to upgrade to BizOS Pro? Pro gives you unlimited AI, cloud backup, and multi-device access for ₹999/month.",
        actionType: "upgrade_plan",
        actionData: { upgradeUrl: "/billing" },
      };
    }
    default:
      return { executed: false, requiresConfirmation: false };
  }
}

router.post("/ai/prompt", requireAuth, async (req: AuthRequest, res) => {
  const result = SendAiPromptBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation error", message: result.error.message });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user) { res.status(401).json({ error: "Unauthorized", message: "User not found" }); return; }

  const limit = user.plan === "pro" ? 999999 : FREE_PLAN_LIMIT;
  if (user.aiPromptsUsed >= limit) {
    res.status(403).json({
      error: "Limit reached",
      message: user.plan === "free"
        ? `You've used all ${FREE_PLAN_LIMIT} free AI prompts. Upgrade to Pro for unlimited access.`
        : "AI prompt limit reached.",
    });
    return;
  }

  const { prompt } = result.data;
  const intent = classifyIntent(prompt);
  const [context, actionResult] = await Promise.all([
    getBusinessContext(req.userId!),
    resolveAction(intent, req.userId!),
  ]);

  let subscriptionContext = "";
  if (intent === "subscription_status" && actionResult.actionData) {
    const sub = actionResult.actionData as Awaited<ReturnType<typeof getSubscriptionContext>>;
    subscriptionContext = `\nSubscription context: ${JSON.stringify(sub)}`;
  }

  const systemPrompt = `You are BizOS AI, a smart business assistant for Indian SMEs. You answer questions about business data, financials, and subscriptions.

Business data:
${JSON.stringify(context, null, 2)}${subscriptionContext}

Rules:
- Answer only from the provided data
- Format currency as ₹ with Indian number formatting
- Be concise and use bullet points for lists
- For action commands (backup, upgrade, mark paid), explain what will happen and say it requires confirmation
- For subscription queries, give the current plan status
- Don't make up data you don't have`;

  let answer = "";
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 1024,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
    });
    answer = response.choices[0]?.message?.content ?? "I couldn't generate a response. Please try again.";
  } catch {
    answer = "AI service temporarily unavailable. Here's your data summary:\n\n" +
      `• Revenue: ₹${context.summary.totalRevenue.toLocaleString("en-IN")}\n` +
      `• Unpaid Invoices: ${context.summary.unpaidCount} (₹${context.summary.unpaidAmount.toLocaleString("en-IN")})\n` +
      `• Low Stock Items: ${context.summary.lowStockCount}\n` +
      `• Net Profit: ₹${context.summary.netProfit.toLocaleString("en-IN")}`;
  }

  await db.update(usersTable)
    .set({ aiPromptsUsed: user.aiPromptsUsed + 1, updatedAt: new Date() })
    .where(eq(usersTable.id, req.userId!));

  await db.insert(aiPromptLogsTable).values({
    userId: req.userId!,
    prompt,
    intent,
    response: answer,
  });

  await db.insert(auditLogsTable).values({
    userId: req.userId!,
    action: "ai_prompt",
    entity: "ai_prompt_log",
    description: `AI prompt: "${prompt.slice(0, 80)}..." Intent: ${intent}`,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  const remaining = Math.max(0, limit - (user.aiPromptsUsed + 1));
  res.json({
    answer,
    intent,
    data: context.summary,
    requiresConfirmation: actionResult.requiresConfirmation,
    confirmationMessage: actionResult.confirmationMessage,
    actionType: actionResult.actionType,
    actionData: actionResult.actionData,
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
  if (!user) { res.status(401).json({ error: "Unauthorized", message: "User not found" }); return; }
  const limit = user.plan === "pro" ? 999999 : FREE_PLAN_LIMIT;
  res.json({ used: user.aiPromptsUsed, limit, remaining: Math.max(0, limit - user.aiPromptsUsed), plan: user.plan });
});

export default router;
