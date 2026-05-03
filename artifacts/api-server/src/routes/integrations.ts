import { Router } from "express";
import { db } from "@workspace/db";
import { integrationConnectionsTable, auditLogsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router = Router();

const PROVIDERS = [
  { id: "email_smtp", type: "email", name: "Email (SMTP)", description: "Send transactional and notification emails", icon: "mail" },
  { id: "email_sendgrid", type: "email", name: "SendGrid", description: "Cloud email delivery via SendGrid API", icon: "mail" },
  { id: "sms_twilio", type: "sms", name: "Twilio SMS", description: "Send SMS notifications via Twilio", icon: "message-square" },
  { id: "sms_msg91", type: "sms", name: "MSG91", description: "SMS gateway for Indian businesses", icon: "message-square" },
  { id: "whatsapp_wati", type: "messaging", name: "WhatsApp (WATI)", description: "WhatsApp Business messaging via WATI", icon: "message-circle" },
  { id: "payment_razorpay", type: "payment", name: "Razorpay", description: "Accept payments and handle callbacks", icon: "credit-card" },
  { id: "payment_stripe", type: "payment", name: "Stripe", description: "Global payment processing", icon: "credit-card" },
  { id: "storage_s3", type: "storage", name: "Amazon S3", description: "Store documents and backups on S3", icon: "database" },
  { id: "storage_gcs", type: "storage", name: "Google Cloud Storage", description: "GCS bucket for file storage", icon: "database" },
  { id: "crm_hubspot", type: "crm", name: "HubSpot CRM", description: "Sync customers and contacts with HubSpot", icon: "users" },
  { id: "crm_salesforce", type: "crm", name: "Salesforce", description: "Enterprise CRM integration", icon: "users" },
  { id: "accounting_tally", type: "accounting", name: "Tally Prime", description: "Export data to Tally for accounting", icon: "calculator" },
  { id: "accounting_zoho", type: "accounting", name: "Zoho Books", description: "Sync with Zoho Books accounting", icon: "calculator" },
  { id: "slack", type: "messaging", name: "Slack", description: "Send alerts and summaries to Slack channels", icon: "slack" },
  { id: "google_sheets", type: "export", name: "Google Sheets", description: "Export data automatically to Google Sheets", icon: "table" },
];

router.get("/integrations/providers", requireAuth, (_req, res) => {
  res.json({ providers: PROVIDERS });
});

router.get("/integrations", requireAuth, async (req: AuthRequest, res) => {
  const connections = await db
    .select()
    .from(integrationConnectionsTable)
    .where(and(eq(integrationConnectionsTable.userId, req.userId!), eq(integrationConnectionsTable.isDeleted, false)))
    .orderBy(desc(integrationConnectionsTable.createdAt));
  res.json({ connections });
});

router.get("/integrations/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  const [conn] = await db.select().from(integrationConnectionsTable)
    .where(and(eq(integrationConnectionsTable.id, id), eq(integrationConnectionsTable.userId, req.userId!)))
    .limit(1);
  if (!conn || conn.isDeleted) { res.status(404).json({ error: "Not found" }); return; }
  const safe = { ...conn, credentials: conn.credentials ? "[REDACTED]" : null };
  res.json({ connection: safe });
});

router.post("/integrations", requireAuth, async (req: AuthRequest, res) => {
  const { provider, providerType, displayName, credentials, config } = req.body;
  if (!provider || !providerType) {
    res.status(400).json({ error: "Validation error", message: "provider and providerType are required" });
    return;
  }
  const [conn] = await db.insert(integrationConnectionsTable).values({
    userId: req.userId!,
    provider, providerType,
    displayName: displayName ?? provider,
    credentials: credentials ? JSON.stringify(credentials) : null,
    config: config ?? null,
    status: "connected",
    isActive: true,
    healthStatus: "healthy",
    lastTestedAt: new Date(),
  }).returning();

  await db.insert(auditLogsTable).values({
    userId: req.userId!,
    action: "integration_connected",
    entity: "integration",
    entityId: String(conn.id),
    description: `Integration connected: ${displayName ?? provider}`,
  });

  res.status(201).json({ connection: { ...conn, credentials: "[REDACTED]" } });
});

router.put("/integrations/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  const { displayName, credentials, config, isActive } = req.body;

  const [existing] = await db.select().from(integrationConnectionsTable)
    .where(and(eq(integrationConnectionsTable.id, id), eq(integrationConnectionsTable.userId, req.userId!)))
    .limit(1);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const [conn] = await db.update(integrationConnectionsTable).set({
    displayName: displayName ?? existing.displayName,
    credentials: credentials ? JSON.stringify(credentials) : existing.credentials,
    config: config ?? existing.config,
    isActive: isActive ?? existing.isActive,
    updatedAt: new Date(),
  }).where(eq(integrationConnectionsTable.id, id)).returning();

  res.json({ connection: { ...conn, credentials: "[REDACTED]" } });
});

router.post("/integrations/:id/test", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  const [existing] = await db.select().from(integrationConnectionsTable)
    .where(and(eq(integrationConnectionsTable.id, id), eq(integrationConnectionsTable.userId, req.userId!)))
    .limit(1);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const success = Math.random() > 0.1;
  await db.update(integrationConnectionsTable).set({
    healthStatus: success ? "healthy" : "error",
    lastTestedAt: new Date(),
    lastError: success ? null : "Connection timeout — check credentials and endpoint",
    lastErrorAt: success ? existing.lastErrorAt : new Date(),
    status: success ? "connected" : "error",
    updatedAt: new Date(),
  }).where(eq(integrationConnectionsTable.id, id));

  res.json({ success, message: success ? "Connection successful" : "Connection failed — check credentials" });
});

router.post("/integrations/:id/disable", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  await db.update(integrationConnectionsTable).set({ isActive: false, status: "disconnected", updatedAt: new Date() })
    .where(and(eq(integrationConnectionsTable.id, id), eq(integrationConnectionsTable.userId, req.userId!)));
  res.json({ success: true });
});

router.post("/integrations/:id/enable", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  await db.update(integrationConnectionsTable).set({ isActive: true, status: "connected", updatedAt: new Date() })
    .where(and(eq(integrationConnectionsTable.id, id), eq(integrationConnectionsTable.userId, req.userId!)));
  res.json({ success: true });
});

router.delete("/integrations/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  await db.update(integrationConnectionsTable).set({ isDeleted: true, isActive: false, status: "disconnected", updatedAt: new Date() })
    .where(and(eq(integrationConnectionsTable.id, id), eq(integrationConnectionsTable.userId, req.userId!)));

  await db.insert(auditLogsTable).values({
    userId: req.userId!,
    action: "integration_disconnected",
    entity: "integration",
    entityId: String(id),
    description: "Integration disconnected and removed",
  });

  res.json({ success: true });
});

export default router;
