import { Router } from "express";
import { db } from "@workspace/db";
import { vendorsTable, auditLogsTable } from "@workspace/db";
import { eq, ilike, or, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/vendors", requireAuth, async (req: AuthRequest, res) => {
  const q = req.query.q as string | undefined;
  const query = db.select().from(vendorsTable).where(eq(vendorsTable.isDeleted, false));
  const vendors = await db
    .select()
    .from(vendorsTable)
    .where(eq(vendorsTable.isDeleted, false))
    .orderBy(desc(vendorsTable.createdAt));

  const filtered = q
    ? vendors.filter(
        (v) =>
          v.name.toLowerCase().includes(q.toLowerCase()) ||
          v.email?.toLowerCase().includes(q.toLowerCase()) ||
          v.gstin?.toLowerCase().includes(q.toLowerCase())
      )
    : vendors;

  res.json({ vendors: filtered });
});

router.get("/vendors/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  const [vendor] = await db
    .select()
    .from(vendorsTable)
    .where(eq(vendorsTable.id, id))
    .limit(1);
  if (!vendor || vendor.isDeleted) {
    res.status(404).json({ error: "Not found", message: "Vendor not found" });
    return;
  }
  res.json({ vendor });
});

router.post("/vendors", requireAuth, async (req: AuthRequest, res) => {
  const { name, legalName, gstin, pan, contactPerson, email, phone, address, city, state, pincode, category, paymentTerms, bankAccountName, bankAccountNumber, bankIfsc, notes } = req.body;
  if (!name) {
    res.status(400).json({ error: "Validation error", message: "name is required" });
    return;
  }
  const [vendor] = await db.insert(vendorsTable).values({
    name, legalName, gstin, pan, contactPerson, email, phone,
    address, city, state, pincode, category, paymentTerms,
    bankAccountName, bankAccountNumber, bankIfsc, notes,
  }).returning();

  await db.insert(auditLogsTable).values({
    userId: req.userId!,
    action: "vendor_created",
    entity: "vendor",
    entityId: String(vendor.id),
    description: `Vendor created: ${name}`,
  });

  res.status(201).json({ vendor });
});

router.put("/vendors/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  const { name, legalName, gstin, pan, contactPerson, email, phone, address, city, state, pincode, category, paymentTerms, bankAccountName, bankAccountNumber, bankIfsc, notes, isActive } = req.body;

  const [vendor] = await db
    .update(vendorsTable)
    .set({ name, legalName, gstin, pan, contactPerson, email, phone, address, city, state, pincode, category, paymentTerms, bankAccountName, bankAccountNumber, bankIfsc, notes, isActive, updatedAt: new Date() })
    .where(eq(vendorsTable.id, id))
    .returning();

  if (!vendor) {
    res.status(404).json({ error: "Not found", message: "Vendor not found" });
    return;
  }

  await db.insert(auditLogsTable).values({
    userId: req.userId!,
    action: "vendor_updated",
    entity: "vendor",
    entityId: String(id),
    description: `Vendor updated: ${vendor.name}`,
  });

  res.json({ vendor });
});

router.delete("/vendors/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  await db.update(vendorsTable).set({ isDeleted: true, updatedAt: new Date() }).where(eq(vendorsTable.id, id));

  await db.insert(auditLogsTable).values({
    userId: req.userId!,
    action: "vendor_deleted",
    entity: "vendor",
    entityId: String(id),
    description: `Vendor deleted`,
  });

  res.json({ success: true });
});

export default router;
