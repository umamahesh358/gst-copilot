import { Router } from "express";
import { db } from "@workspace/db";
import { automationRulesTable, auditLogsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/automation/rules", requireAuth, async (req: AuthRequest, res) => {
  const rules = await db
    .select()
    .from(automationRulesTable)
    .where(eq(automationRulesTable.userId, req.userId!))
    .orderBy(desc(automationRulesTable.createdAt));

  res.json({ rules });
});

router.post("/automation/rules", requireAuth, async (req: AuthRequest, res) => {
  const { name, description, triggerType, triggerConfig, conditionConfig, actionType, actionConfig, isActive, nextRunAt } = req.body;

  if (!name || !triggerType || !actionType) {
    res.status(400).json({ error: "Validation error", message: "name, triggerType, and actionType are required" });
    return;
  }

  const [rule] = await db
    .insert(automationRulesTable)
    .values({
      userId: req.userId!,
      name,
      description,
      triggerType,
      triggerConfig,
      conditionConfig,
      actionType,
      actionConfig,
      isActive: isActive ?? true,
      nextRunAt: nextRunAt ? new Date(nextRunAt) : null,
    })
    .returning();

  await db.insert(auditLogsTable).values({
    userId: req.userId!,
    action: "automation_rule_created",
    entity: "automation_rule",
    entityId: String(rule.id),
    description: `Automation rule created: ${name}`,
  });

  res.status(201).json({ rule });
});

router.put("/automation/rules/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  const { name, description, triggerType, triggerConfig, conditionConfig, actionType, actionConfig, isActive } = req.body;

  const [rule] = await db
    .update(automationRulesTable)
    .set({ name, description, triggerType, triggerConfig, conditionConfig, actionType, actionConfig, isActive, updatedAt: new Date() })
    .where(and(eq(automationRulesTable.id, id), eq(automationRulesTable.userId, req.userId!)))
    .returning();

  if (!rule) {
    res.status(404).json({ error: "Not found", message: "Rule not found" });
    return;
  }

  res.json({ rule });
});

router.patch("/automation/rules/:id/toggle", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  const [current] = await db
    .select()
    .from(automationRulesTable)
    .where(and(eq(automationRulesTable.id, id), eq(automationRulesTable.userId, req.userId!)))
    .limit(1);

  if (!current) {
    res.status(404).json({ error: "Not found", message: "Rule not found" });
    return;
  }

  const [rule] = await db
    .update(automationRulesTable)
    .set({ isActive: !current.isActive, updatedAt: new Date() })
    .where(eq(automationRulesTable.id, id))
    .returning();

  res.json({ rule });
});

router.delete("/automation/rules/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  await db.delete(automationRulesTable).where(and(eq(automationRulesTable.id, id), eq(automationRulesTable.userId, req.userId!)));

  await db.insert(auditLogsTable).values({
    userId: req.userId!,
    action: "automation_rule_deleted",
    entity: "automation_rule",
    entityId: String(id),
    description: `Automation rule deleted`,
  });

  res.json({ success: true });
});

export default router;
