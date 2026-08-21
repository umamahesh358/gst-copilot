import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  subscriptionsTable,
  paymentsTable,
  notificationsTable,
  auditLogsTable,
} from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router = Router();

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: 0,
    billingCycle: null,
    currency: "INR",
    features: [
      "Up to 10 invoices/month",
      "Basic inventory management",
      "3 AI prompts/month",
      "1 device",
      "Manual export only",
    ],
    limits: { invoices: 10, aiPrompts: 3, devices: 1, backups: 0 },
  },
  {
    id: "pro_monthly",
    name: "Pro Monthly",
    price: 999,
    billingCycle: "monthly",
    currency: "INR",
    features: [
      "Unlimited invoices",
      "Full inventory & accounting",
      "Unlimited AI prompts",
      "Up to 3 devices",
      "Cloud backup & restore",
      "GST filing support",
      "Priority support",
    ],
    limits: { invoices: -1, aiPrompts: -1, devices: 3, backups: 10 },
  },
  {
    id: "pro_yearly",
    name: "Pro Yearly",
    price: 8999,
    billingCycle: "yearly",
    currency: "INR",
    badge: "Save 25%",
    features: [
      "Everything in Pro Monthly",
      "25% discount vs monthly",
      "Up to 5 devices",
      "Unlimited cloud backups",
      "Audit logs",
      "Dedicated account manager",
    ],
    limits: { invoices: -1, aiPrompts: -1, devices: 5, backups: -1 },
  },
];

router.get("/billing/plans", (_req, res) => {
  res.json({ plans: PLANS });
});

router.get("/billing/subscription", requireAuth, async (req: AuthRequest, res) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user) { res.status(401).json({ error: "Unauthorized", message: "User not found" }); return; }

  const [sub] = await db.select().from(subscriptionsTable)
    .where(and(eq(subscriptionsTable.userId, req.userId!), eq(subscriptionsTable.status, "active")))
    .orderBy(desc(subscriptionsTable.createdAt))
    .limit(1);

  const plan = PLANS.find(p => p.id === user.plan) || PLANS[0];
  res.json({
    plan: user.plan,
    planDetails: plan,
    subscription: sub || null,
    aiPromptsUsed: user.aiPromptsUsed,
    aiPromptsLimit: user.aiPromptsLimit,
  });
});

router.post("/billing/checkout", requireAuth, async (req: AuthRequest, res) => {
  const planId = req.body?.planId;
  if (!planId || !["pro_monthly", "pro_yearly"].includes(planId)) {
    res.status(400).json({ error: "Validation error", message: "planId must be pro_monthly or pro_yearly" });
    return;
  }
  const plan = PLANS.find(p => p.id === planId);
  if (!plan) { res.status(400).json({ error: "Invalid plan", message: "Plan not found" }); return; }

  const fakeOrderId = `order_${Date.now()}_${req.userId}`;

  const [payment] = await db.insert(paymentsTable).values({
    userId: req.userId!,
    plan: planId,
    billingCycle: plan.billingCycle,
    amount: String(plan.price),
    currency: "INR",
    status: "pending",
    gateway: "razorpay",
    gatewayOrderId: fakeOrderId,
    description: `BizOS ${plan.name} subscription`,
  }).returning();

  await db.insert(auditLogsTable).values({
    userId: req.userId!,
    action: "checkout_initiated",
    entity: "payment",
    entityId: String(payment.id),
    description: `Checkout initiated for ${plan.name}`,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
  if (!razorpayKeyId) {
    res.status(503).json({ error: "Payment not configured", message: "Razorpay payment gateway is not set up. Contact support." });
    return;
  }

  res.json({
    orderId: fakeOrderId,
    paymentId: payment.id,
    amount: plan.price * 100,
    currency: "INR",
    plan: planId,
    planName: plan.name,
    keyId: razorpayKeyId,
    prefill: { name: "", email: "" },
  });
});

router.post("/billing/verify", requireAuth, async (req: AuthRequest, res) => {
  const { paymentId, gatewayPaymentId, gatewayOrderId, gatewaySignature } = req.body || {};
  if (!paymentId || !gatewayPaymentId || !gatewayOrderId) {
    res.status(400).json({ error: "Validation error", message: "paymentId, gatewayPaymentId, and gatewayOrderId are required" });
    return;
  }

  const [payment] = await db.select().from(paymentsTable)
    .where(and(eq(paymentsTable.id, paymentId), eq(paymentsTable.userId, req.userId!)))
    .limit(1);

  if (!payment) { res.status(404).json({ error: "Not found", message: "Payment record not found" }); return; }
  if (payment.status === "paid") { res.json({ success: true, alreadyVerified: true }); return; }

  const plan = PLANS.find(p => p.id === payment.plan);
  if (!plan) { res.status(400).json({ error: "Invalid plan", message: "Plan not found" }); return; }

  const now = new Date();
  const endDate = payment.billingCycle === "yearly"
    ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
    : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  await db.update(paymentsTable).set({
    status: "paid",
    gatewayPaymentId,
    gatewaySignature: gatewaySignature || null,
    paidAt: now,
  }).where(eq(paymentsTable.id, paymentId));

  const [sub] = await db.insert(subscriptionsTable).values({
    userId: req.userId!,
    plan: payment.plan,
    status: "active",
    billingCycle: payment.billingCycle,
    amount: payment.amount,
    currency: "INR",
    startDate: now,
    endDate,
    renewalDate: endDate,
    razorpayOrderId: gatewayOrderId,
    autoRenew: true,
  }).returning();

  const normalizedPlan = payment.plan === "pro_yearly" || payment.plan === "pro_monthly" ? "pro" : "free";
  const aiLimit = plan.limits.aiPrompts === -1 ? 999999 : plan.limits.aiPrompts;

  await db.update(usersTable).set({
    plan: normalizedPlan,
    aiPromptsLimit: aiLimit,
    updatedAt: now,
  }).where(eq(usersTable.id, req.userId!));

  await db.insert(notificationsTable).values({
    userId: req.userId!,
    type: "success",
    title: "Subscription Activated",
    message: `Welcome to ${plan.name}! Your subscription is now active until ${endDate.toLocaleDateString("en-IN")}.`,
    actionLabel: "View Billing",
    actionUrl: "/billing",
  });

  await db.insert(auditLogsTable).values({
    userId: req.userId!,
    action: "subscription_activated",
    entity: "subscription",
    entityId: String(sub.id),
    description: `Subscription activated: ${plan.name}`,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.json({ success: true, subscription: sub, plan: normalizedPlan });
});

router.get("/billing/history", requireAuth, async (req: AuthRequest, res) => {
  const limit = parseInt(req.query.limit as string) || 20;
  const payments = await db.select().from(paymentsTable)
    .where(eq(paymentsTable.userId, req.userId!))
    .orderBy(desc(paymentsTable.createdAt))
    .limit(limit);
  res.json({ payments });
});

router.post("/billing/cancel", requireAuth, async (req: AuthRequest, res) => {
  const reason = req.body?.reason || "User requested";

  const [sub] = await db.select().from(subscriptionsTable)
    .where(and(eq(subscriptionsTable.userId, req.userId!), eq(subscriptionsTable.status, "active")))
    .orderBy(desc(subscriptionsTable.createdAt))
    .limit(1);

  if (!sub) { res.status(404).json({ error: "Not found", message: "No active subscription found" }); return; }

  await db.update(subscriptionsTable).set({
    status: "cancelled",
    cancelledAt: new Date(),
    cancelReason: reason,
    autoRenew: false,
  }).where(eq(subscriptionsTable.id, sub.id));

  await db.insert(auditLogsTable).values({
    userId: req.userId!,
    action: "subscription_cancelled",
    entity: "subscription",
    entityId: String(sub.id),
    description: `Subscription cancelled. Reason: ${reason}`,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.json({ success: true, message: "Subscription cancelled. You will retain access until the end of your billing period." });
});

export default router;
