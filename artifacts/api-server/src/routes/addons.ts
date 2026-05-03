import { Router } from "express";
import { db } from "@workspace/db";
import { addOnsTable, addOnInstallsTable, auditLogsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router = Router();

const BUILT_IN_ADDONS = [
  { slug: "gst-efiling", name: "GST e-Filing Connector", description: "Direct GST return filing via government portal integration.", category: "compliance", version: "1.2.0", author: "BizOS", minPlan: "pro", isFeatured: 1, permissions: ["invoices:read", "gst:file"] },
  { slug: "whatsapp-notify", name: "WhatsApp Notifications", description: "Send invoice and payment notifications via WhatsApp Business API.", category: "communication", version: "1.0.0", author: "BizOS", minPlan: "pro", isFeatured: 1, permissions: ["notifications:send", "customers:read"] },
  { slug: "tally-sync", name: "Tally Prime Sync", description: "Bidirectional sync with Tally Prime for accounting data.", category: "accounting", version: "2.1.0", author: "BizOS", minPlan: "pro", isFeatured: 1, permissions: ["accounting:read", "accounting:write"] },
  { slug: "bank-import", name: "Bank Statement Importer", description: "Import bank statements from major Indian banks for reconciliation.", category: "finance", version: "1.5.0", author: "BizOS", minPlan: "pro", isFeatured: 0, permissions: ["reconciliation:write"] },
  { slug: "ai-invoice-ocr", name: "AI Invoice OCR", description: "Extract invoice data automatically from uploaded PDFs using AI.", category: "ai", version: "1.1.0", author: "BizOS", minPlan: "pro", isFeatured: 1, permissions: ["documents:read", "invoices:write"] },
  { slug: "email-campaigns", name: "Email Campaigns", description: "Send promotional and transactional emails to customer segments.", category: "marketing", version: "1.0.0", author: "BizOS", minPlan: "pro", isFeatured: 0, permissions: ["customers:read", "notifications:send"] },
  { slug: "inventory-forecast", name: "Inventory Forecasting", description: "AI-powered demand forecasting and reorder recommendations.", category: "ai", version: "1.0.0", author: "BizOS", minPlan: "pro", isFeatured: 0, permissions: ["inventory:read"] },
  { slug: "payment-gateway", name: "Payment Gateway Bundle", description: "Accept Razorpay, PayU, and Cashfree payments directly from invoices.", category: "payments", version: "2.0.0", author: "BizOS", minPlan: "pro", isFeatured: 1, permissions: ["invoices:read", "payments:write"] },
];

router.get("/addons", requireAuth, async (req: AuthRequest, res) => {
  let addons = await db.select().from(addOnsTable);
  if (addons.length === 0) {
    await db.insert(addOnsTable).values(BUILT_IN_ADDONS.map(a => ({ ...a, isActive: 1 })));
    addons = await db.select().from(addOnsTable);
  }

  const installs = await db.select().from(addOnInstallsTable).where(eq(addOnInstallsTable.userId, req.userId!));
  const installedIds = new Set(installs.filter(i => i.status === "active").map(i => i.addOnId));

  res.json({
    addons: addons.map(a => ({ ...a, installed: installedIds.has(a.id) })),
    installed: installs.length,
  });
});

router.post("/addons/:slug/install", requireAuth, async (req: AuthRequest, res) => {
  const [addon] = await db.select().from(addOnsTable).where(eq(addOnsTable.slug, req.params.slug));
  if (!addon) { res.status(404).json({ error: "Add-on not found" }); return; }

  const existing = await db.select().from(addOnInstallsTable).where(
    and(eq(addOnInstallsTable.addOnId, addon.id), eq(addOnInstallsTable.userId, req.userId!))
  );

  if (existing.length > 0) {
    const [updated] = await db.update(addOnInstallsTable).set({ status: "active", deactivatedAt: null })
      .where(and(eq(addOnInstallsTable.addOnId, addon.id), eq(addOnInstallsTable.userId, req.userId!))).returning();
    res.json({ install: updated, addon });
    return;
  }

  const [install] = await db.insert(addOnInstallsTable).values({
    addOnId: addon.id,
    userId: req.userId!,
    status: "active",
    config: req.body.config ?? null,
  }).returning();

  await db.insert(auditLogsTable).values({
    userId: req.userId!,
    action: "install",
    entity: "addon",
    entityId: String(addon.id),
    description: `Installed add-on: ${addon.name}`,
  });

  res.status(201).json({ install, addon });
});

router.post("/addons/:slug/uninstall", requireAuth, async (req: AuthRequest, res) => {
  const [addon] = await db.select().from(addOnsTable).where(eq(addOnsTable.slug, req.params.slug));
  if (!addon) { res.status(404).json({ error: "Not found" }); return; }

  await db.update(addOnInstallsTable).set({ status: "inactive", deactivatedAt: new Date() })
    .where(and(eq(addOnInstallsTable.addOnId, addon.id), eq(addOnInstallsTable.userId, req.userId!)));

  await db.insert(auditLogsTable).values({
    userId: req.userId!,
    action: "uninstall",
    entity: "addon",
    entityId: String(addon.id),
    description: `Uninstalled add-on: ${addon.name}`,
  });

  res.json({ success: true });
});

router.get("/addons/:slug", requireAuth, async (req: AuthRequest, res) => {
  const [addon] = await db.select().from(addOnsTable).where(eq(addOnsTable.slug, req.params.slug));
  if (!addon) { res.status(404).json({ error: "Not found" }); return; }
  const installs = await db.select().from(addOnInstallsTable).where(
    and(eq(addOnInstallsTable.addOnId, addon.id), eq(addOnInstallsTable.userId, req.userId!))
  );
  res.json({ addon: { ...addon, installed: installs.some(i => i.status === "active") }, install: installs[0] ?? null });
});

export default router;
