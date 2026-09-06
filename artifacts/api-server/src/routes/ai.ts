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
    db.select().from(invoicesTable).where(eq(invoicesTable.userId, userId)).orderBy(sql`${invoicesTable.createdAt} DESC`).limit(50),
    db.select().from(productsTable).where(and(eq(productsTable.userId, userId), eq(productsTable.isDeleted, false))),
    db.select().from(transactionsTable).where(eq(transactionsTable.userId, userId)).orderBy(sql`${transactionsTable.date} DESC`).limit(50),
    db.select().from(customersTable).where(eq(customersTable.userId, userId)).limit(20),
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

  const systemPrompt = `You are BizOS AI, a sharp and friendly business assistant for Indian SMEs. You analyse real business data and give clear, actionable insights in a simple, easy-to-understand way like Claude.

Business data (live):
${JSON.stringify(context, null, 2)}${subscriptionContext}

FORMATTING RULES (always follow these):
- Start with a short plain-English summary
- Keep answers concise, warm, and direct
- Use bullets only when they make the answer easier to scan
- Use **bold** only for key numbers or important words
- Avoid long paragraphs, jargon, and unnecessary formatting
- Prefer simple explanations over detailed breakdowns
- If the user asks for action, clearly say what will happen and whether confirmation is needed
- End with 1 clear next step if relevant

CONTENT RULES:
- Answer only from the provided data — never make up figures
- Format all currency as ₹X,XX,XXX (Indian format with commas)
- For action commands (backup, upgrade, mark paid) — explain what will happen and note it needs confirmation
- For subscription queries — give current plan, limits, and upgrade benefits
- If data is empty or zero, say so clearly and suggest what to do next`;

  let answer = "";
  try {
    const response = await openai.chat.completions.create({
      model: process.env.AI_MODEL ?? "llama-3.1-8b-instant",
      max_tokens: 1024,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
    });
    answer = response.choices[0]?.message?.content ?? "I couldn't generate a response. Please try again.";
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[AI] Groq API call failed:", errorMsg);
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

router.post("/ai/extract-invoice", requireAuth, async (req: AuthRequest, res) => {
  const { imageBase64, mimeType } = req.body as { imageBase64?: string; mimeType?: string };
  if (!imageBase64) {
    res.status(400).json({ error: "Bad request", message: "imageBase64 is required" });
    return;
  }
  const mime = mimeType || "image/jpeg";
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:${mime};base64,${imageBase64}`, detail: "high" },
            },
            {
              type: "text",
              text: `You are an expert at reading Indian GST invoices. Extract all details from this invoice image and return ONLY a valid JSON object (no markdown, no explanation) with exactly this structure:
{
  "invoiceNumber": "string or empty",
  "invoiceDate": "YYYY-MM-DD or empty",
  "sellerName": "string or empty",
  "sellerGstin": "string or empty",
  "sellerAddress": "string or empty",
  "buyerName": "string or empty",
  "buyerGstin": "string or empty",
  "buyerAddress": "string or empty",
  "notes": "string or empty",
  "items": [
    {
      "productName": "string",
      "hsnCode": "string or empty",
      "quantity": number,
      "unitPrice": number,
      "gstRate": number
    }
  ]
}
Rules:
- gstRate must be one of: 0, 5, 12, 18, 28
- unitPrice must be the base price BEFORE GST
- quantity and unitPrice must be positive numbers
- If you cannot read a field clearly, use an empty string or 0
- Return at least one item in items array`,
            },
          ],
        },
      ],
    });

    const raw = response.choices[0]?.message?.content || "{}";
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    let extracted: Record<string, unknown> = {};
    try {
      extracted = JSON.parse(cleaned);
    } catch {
      res.status(422).json({ error: "Parse error", message: "Could not parse AI response as JSON" });
      return;
    }
    res.json(extracted);
  } catch (err: any) {
    req.log.error({ err }, "extract-invoice AI error");
    res.status(500).json({ error: "AI error", message: err.message || "Failed to extract invoice data" });
  }
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

// Diagnostic endpoint — tests Groq connectivity directly
router.get("/ai/test", requireAuth, async (_req: AuthRequest, res) => {
  try {
    const model = process.env.AI_MODEL ?? "llama-3.1-8b-instant";
    const baseURL = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
    const keyPreview = (process.env.OPENAI_API_KEY ?? "").substring(0, 8) + "...";
    const response = await openai.chat.completions.create({
      model,
      max_tokens: 10,
      messages: [{ role: "user", content: "Say OK" }],
    });
    res.json({
      status: "ok",
      model,
      baseURL,
      keyPreview,
      response: response.choices[0]?.message?.content,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[AI] Test failed:", errorMsg);
    res.status(500).json({
      status: "error",
      model: process.env.AI_MODEL ?? "llama-3.1-8b-instant",
      baseURL: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
      keyPreview: (process.env.OPENAI_API_KEY ?? "").substring(0, 8) + "...",
      error: errorMsg,
    });
  }
});

export default router;

