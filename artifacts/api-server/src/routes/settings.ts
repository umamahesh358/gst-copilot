import { Router } from "express";
import { db } from "@workspace/db";
import { appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UpdateSettingsBody } from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/settings", requireAuth, async (req: AuthRequest, res) => {
  const [settings] = await db.select().from(appSettingsTable)
    .where(eq(appSettingsTable.userId, req.userId!))
    .limit(1);

  if (!settings) {
    res.status(404).json({ error: "Not found", message: "Settings not found" });
    return;
  }

  res.json(settings);
});

router.patch("/settings", requireAuth, async (req: AuthRequest, res) => {
  const result = UpdateSettingsBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation error", message: result.error.message });
    return;
  }

  const data = result.data;
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (data.theme !== undefined) updateData.theme = data.theme;
  if (data.businessName !== undefined) updateData.businessName = data.businessName;
  if (data.gstNumber !== undefined) updateData.gstNumber = data.gstNumber;
  if (data.address !== undefined) updateData.address = data.address;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.invoicePrefix !== undefined) updateData.invoicePrefix = data.invoicePrefix;
  if (data.currency !== undefined) updateData.currency = data.currency;
  if (data.currencySymbol !== undefined) updateData.currencySymbol = data.currencySymbol;
  if (data.taxLabel !== undefined) updateData.taxLabel = data.taxLabel;

  const [settings] = await db.update(appSettingsTable)
    .set(updateData as Parameters<typeof db.update>[0])
    .where(eq(appSettingsTable.userId, req.userId!))
    .returning();

  if (!settings) {
    res.status(404).json({ error: "Not found", message: "Settings not found" });
    return;
  }

  res.json(settings);
});

export default router;
