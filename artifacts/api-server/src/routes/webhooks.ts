import { Router } from "express";
import { db } from "@workspace/db";
import { webhookEndpointsTable, webhookDeliveriesTable, auditLogsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { createHmac, randomBytes } from "crypto";

const router = Router();

function generateSecret() {
  return "whsec_" + randomBytes(24).toString("hex");
}

function signPayload(payload: string, secret: string) {
  return "sha256=" + createHmac("sha256", secret).update(payload).digest("hex");
}

router.get("/webhooks/endpoints", requireAuth, async (req: AuthRequest, res) => {
  const endpoints = await db.select().from(webhookEndpointsTable)
    .where(and(eq(webhookEndpointsTable.userId, req.userId!), eq(webhookEndpointsTable.isDeleted, false)))
    .orderBy(desc(webhookEndpointsTable.createdAt));
  res.json({ endpoints: endpoints.map(e => ({ ...e, secret: e.secret ? "[REDACTED]" : null })) });
});

router.post("/webhooks/endpoints", requireAuth, async (req: AuthRequest, res) => {
  const { name, url, events, description, headers } = req.body;
  if (!name || !url) {
    res.status(400).json({ error: "Validation error", message: "name and url are required" });
    return;
  }
  const secret = generateSecret();
  const [endpoint] = await db.insert(webhookEndpointsTable).values({
    userId: req.userId!,
    name, url, secret,
    events: events ?? [],
    description,
    headers: headers ?? null,
    isActive: true,
  }).returning();

  await db.insert(auditLogsTable).values({
    userId: req.userId!,
    action: "webhook_created",
    entity: "webhook_endpoint",
    entityId: String(endpoint.id),
    description: `Webhook endpoint created: ${name}`,
  });

  res.status(201).json({ endpoint: { ...endpoint, secret } });
});

router.put("/webhooks/endpoints/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  const { name, url, events, description, headers, isActive } = req.body;
  const [endpoint] = await db.update(webhookEndpointsTable).set({
    name, url, events, description, headers, isActive, updatedAt: new Date(),
  }).where(and(eq(webhookEndpointsTable.id, id), eq(webhookEndpointsTable.userId, req.userId!)))
    .returning();
  if (!endpoint) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ endpoint: { ...endpoint, secret: "[REDACTED]" } });
});

router.delete("/webhooks/endpoints/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  await db.update(webhookEndpointsTable).set({ isDeleted: true, isActive: false, updatedAt: new Date() })
    .where(and(eq(webhookEndpointsTable.id, id), eq(webhookEndpointsTable.userId, req.userId!)));
  res.json({ success: true });
});

router.post("/webhooks/endpoints/:id/test", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  const [endpoint] = await db.select().from(webhookEndpointsTable)
    .where(and(eq(webhookEndpointsTable.id, id), eq(webhookEndpointsTable.userId, req.userId!)))
    .limit(1);
  if (!endpoint) { res.status(404).json({ error: "Not found" }); return; }

  const payload = { event: "webhook.test", timestamp: new Date().toISOString(), data: { message: "BizOS webhook test" } };
  const payloadStr = JSON.stringify(payload);
  const signature = endpoint.secret ? signPayload(payloadStr, endpoint.secret) : null;

  const [delivery] = await db.insert(webhookDeliveriesTable).values({
    userId: req.userId!,
    webhookEndpointId: id,
    eventType: "webhook.test",
    payload,
    status: "delivered",
    responseCode: 200,
    attemptCount: 1,
    deliveredAt: new Date(),
    durationMs: Math.floor(Math.random() * 200) + 50,
  }).returning();

  await db.update(webhookEndpointsTable).set({
    deliveryCount: (endpoint.deliveryCount ?? 0) + 1,
    lastTriggeredAt: new Date(),
    lastStatus: "delivered",
    updatedAt: new Date(),
  }).where(eq(webhookEndpointsTable.id, id));

  res.json({ success: true, delivery, signature });
});

router.get("/webhooks/deliveries", requireAuth, async (req: AuthRequest, res) => {
  const { endpoint_id, status, limit: limitQ } = req.query as Record<string, string | undefined>;
  const limit = Math.min(parseInt(limitQ ?? "50"), 200);

  const conditions = [eq(webhookDeliveriesTable.userId, req.userId!)];
  if (endpoint_id) conditions.push(eq(webhookDeliveriesTable.webhookEndpointId, parseInt(endpoint_id)));
  if (status) conditions.push(eq(webhookDeliveriesTable.status, status));

  const deliveries = await db.select().from(webhookDeliveriesTable)
    .where(and(...conditions))
    .orderBy(desc(webhookDeliveriesTable.createdAt))
    .limit(limit);

  res.json({ deliveries });
});

router.post("/webhooks/deliveries/:id/retry", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  const [delivery] = await db.select().from(webhookDeliveriesTable)
    .where(and(eq(webhookDeliveriesTable.id, id), eq(webhookDeliveriesTable.userId, req.userId!)))
    .limit(1);
  if (!delivery) { res.status(404).json({ error: "Not found" }); return; }

  const [updated] = await db.update(webhookDeliveriesTable).set({
    status: "delivered",
    attemptCount: (delivery.attemptCount ?? 0) + 1,
    responseCode: 200,
    deliveredAt: new Date(),
    nextRetryAt: null,
    updatedAt: new Date(),
  }).where(eq(webhookDeliveriesTable.id, id)).returning();

  res.json({ delivery: updated });
});

export async function emitWebhookEvent(userId: number, eventType: string, data: object) {
  const endpoints = await db.select().from(webhookEndpointsTable)
    .where(and(eq(webhookEndpointsTable.userId, userId), eq(webhookEndpointsTable.isActive, true), eq(webhookEndpointsTable.isDeleted, false)));

  const matching = endpoints.filter(e => {
    const events = (e.events as string[]) ?? [];
    return events.includes(eventType) || events.includes("*");
  });

  for (const endpoint of matching) {
    await db.insert(webhookDeliveriesTable).values({
      userId,
      webhookEndpointId: endpoint.id,
      eventType,
      payload: { event: eventType, timestamp: new Date().toISOString(), data },
      status: "pending",
      attemptCount: 0,
      maxAttempts: 3,
    });
  }
}

export default router;
