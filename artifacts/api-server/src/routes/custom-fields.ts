import { Router } from "express";
import { db } from "@workspace/db";
import { customFieldsTable, customFieldValuesTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router = Router();

const FIELD_TYPES = ["text", "number", "date", "boolean", "select", "multiselect", "textarea", "url", "email", "phone"];
const MODULES = ["customer", "product", "vendor", "invoice", "expense", "transaction"];

router.get("/custom-fields", requireAuth, async (req: AuthRequest, res) => {
  const { module } = req.query as { module?: string };
  const conditions = [eq(customFieldsTable.userId, req.userId!), eq(customFieldsTable.isDeleted, false)];
  if (module) conditions.push(eq(customFieldsTable.module, module));

  const fields = await db.select().from(customFieldsTable)
    .where(and(...conditions))
    .orderBy(customFieldsTable.displayOrder, desc(customFieldsTable.createdAt));

  res.json({ fields });
});

router.post("/custom-fields", requireAuth, async (req: AuthRequest, res) => {
  const { module, name, label, fieldType, isRequired, options, defaultValue, placeholder, validationRule, displayOrder, showInList } = req.body;

  if (!module || !name || !label) {
    res.status(400).json({ error: "Validation error", message: "module, name, and label are required" });
    return;
  }
  if (!MODULES.includes(module)) {
    res.status(400).json({ error: "Validation error", message: `module must be one of: ${MODULES.join(", ")}` });
    return;
  }
  if (fieldType && !FIELD_TYPES.includes(fieldType)) {
    res.status(400).json({ error: "Validation error", message: `fieldType must be one of: ${FIELD_TYPES.join(", ")}` });
    return;
  }

  const [field] = await db.insert(customFieldsTable).values({
    userId: req.userId!,
    module, name, label,
    fieldType: fieldType ?? "text",
    isRequired: isRequired ?? false,
    options: options ?? null,
    defaultValue,
    placeholder,
    validationRule,
    displayOrder: displayOrder ?? 0,
    showInList: showInList ?? false,
  }).returning();

  res.status(201).json({ field });
});

router.put("/custom-fields/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  const { label, isRequired, options, defaultValue, placeholder, validationRule, displayOrder, showInList, isActive } = req.body;

  const [field] = await db.update(customFieldsTable).set({
    label, isRequired, options, defaultValue, placeholder, validationRule, displayOrder, showInList, isActive,
    updatedAt: new Date(),
  }).where(and(eq(customFieldsTable.id, id), eq(customFieldsTable.userId, req.userId!))).returning();

  if (!field) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ field });
});

router.delete("/custom-fields/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  await db.update(customFieldsTable).set({ isDeleted: true, isActive: false, updatedAt: new Date() })
    .where(and(eq(customFieldsTable.id, id), eq(customFieldsTable.userId, req.userId!)));
  res.json({ success: true });
});

router.get("/custom-fields/values/:entityType/:entityId", requireAuth, async (req: AuthRequest, res) => {
  const { entityType, entityId } = req.params as Record<string, string>;
  const values = await db.select().from(customFieldValuesTable)
    .where(and(
      eq(customFieldValuesTable.userId, req.userId!),
      eq(customFieldValuesTable.entityType, entityType),
      eq(customFieldValuesTable.entityId, entityId)
    ));
  res.json({ values });
});

router.post("/custom-fields/values", requireAuth, async (req: AuthRequest, res) => {
  const { customFieldId, entityType, entityId, value } = req.body;
  if (!customFieldId || !entityType || !entityId) {
    res.status(400).json({ error: "Validation error", message: "customFieldId, entityType, and entityId are required" });
    return;
  }

  const existing = await db.select().from(customFieldValuesTable)
    .where(and(
      eq(customFieldValuesTable.customFieldId, customFieldId),
      eq(customFieldValuesTable.entityType, entityType),
      eq(customFieldValuesTable.entityId, entityId)
    )).limit(1);

  let result;
  if (existing.length > 0) {
    [result] = await db.update(customFieldValuesTable).set({ value, updatedAt: new Date() })
      .where(eq(customFieldValuesTable.id, existing[0].id)).returning();
  } else {
    [result] = await db.insert(customFieldValuesTable).values({
      userId: req.userId!, customFieldId, entityType, entityId, value,
    }).returning();
  }

  res.json({ value: result });
});

export default router;
