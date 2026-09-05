import { Router } from "express";
import { db } from "@workspace/db";
import { policyRulesTable, policyViolationsTable, auditLogsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/policy/rules", requireAuth, async (req: AuthRequest, res) => {
  const rules = await db.select().from(policyRulesTable)
    .where(eq(policyRulesTable.userId, req.userId!))
    .orderBy(desc(policyRulesTable.priority));
  res.json({ rules });
});

router.post("/policy/rules", requireAuth, async (req: AuthRequest, res) => {
  const { name, description, module, conditionType, conditionOperator, conditionValue, conditionField, action, priority } = req.body;
  if (!name || !module || !conditionType) {
    res.status(400).json({ error: "Validation error", message: "name, module, conditionType required" });
    return;
  }
  const [rule] = await db.insert(policyRulesTable).values({
    userId: req.userId!,
    name, description, module, conditionType,
    conditionOperator: conditionOperator ?? "gt",
    conditionValue: conditionValue ?? null,
    conditionField: conditionField ?? null,
    action: action ?? "require_approval",
    priority: priority ?? 0,
    isActive: 1,
  }).returning();

  await db.insert(auditLogsTable).values({
    userId: req.userId!,
    action: "create",
    entity: "policy_rule",
    entityId: String(rule.id),
    description: `Created policy rule: ${name}`,
  });
  res.status(201).json({ rule });
});

router.put("/policy/rules/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id));
  const { name, description, conditionOperator, conditionValue, action, isActive, priority } = req.body;
  const [rule] = await db.update(policyRulesTable).set({
    name, description, conditionOperator, conditionValue, action,
    isActive: isActive !== undefined ? (isActive ? 1 : 0) : undefined,
    priority, updatedAt: new Date(),
  }).where(and(eq(policyRulesTable.id, id), eq(policyRulesTable.userId, req.userId!))).returning();
  res.json({ rule });
});

router.delete("/policy/rules/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id));
  await db.delete(policyRulesTable)
    .where(and(eq(policyRulesTable.id, id), eq(policyRulesTable.userId, req.userId!)));
  res.json({ success: true });
});

router.post("/policy/evaluate", requireAuth, async (req: AuthRequest, res) => {
  const { module, action, value, field } = req.body;
  if (!module || !action) {
    res.status(400).json({ error: "module and action required" });
    return;
  }
  const rules = await db.select().from(policyRulesTable).where(
    and(eq(policyRulesTable.userId, req.userId!), eq(policyRulesTable.module, module), eq(policyRulesTable.isActive, 1))
  ).orderBy(desc(policyRulesTable.priority));

  const violations: typeof policyRulesTable.$inferSelect[] = [];
  for (const rule of rules) {
    let triggered = false;
    if (rule.conditionValue !== null && value !== undefined) {
      if (rule.conditionOperator === "gt" && value > rule.conditionValue) triggered = true;
      if (rule.conditionOperator === "gte" && value >= rule.conditionValue) triggered = true;
      if (rule.conditionOperator === "lt" && value < rule.conditionValue) triggered = true;
      if (rule.conditionOperator === "eq" && value === rule.conditionValue) triggered = true;
    }
    if (triggered) violations.push(rule);
  }

  if (violations.length > 0) {
    for (const v of violations) {
      await db.insert(policyViolationsTable).values({
        policyRuleId: v.id,
        userId: req.userId!,
        module,
        entityType: action,
        violationDetail: `Value ${value} triggered rule "${v.name}" (${v.conditionOperator} ${v.conditionValue})`,
        actionTaken: v.action,
        status: "open",
      });
    }
  }

  res.json({
    allowed: violations.length === 0,
    violations: violations.map(v => ({ ruleId: v.id, name: v.name, action: v.action })),
    requiresApproval: violations.some(v => v.action === "require_approval"),
  });
});

router.get("/policy/violations", requireAuth, async (req: AuthRequest, res) => {
  const { status } = req.query as { status?: string };
  const conditions = [eq(policyViolationsTable.userId, req.userId!)];
  if (status) conditions.push(eq(policyViolationsTable.status, status));
  const violations = await db.select().from(policyViolationsTable)
    .where(and(...conditions)).orderBy(desc(policyViolationsTable.createdAt)).limit(100);
  res.json({ violations });
});

router.post("/policy/violations/:id/resolve", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id));
  const [v] = await db.update(policyViolationsTable).set({
    status: "resolved",
    resolvedByUserId: req.userId!,
    resolvedAt: new Date(),
    resolutionNote: req.body.note ?? null,
  }).where(eq(policyViolationsTable.id, id)).returning();
  res.json({ violation: v });
});

export default router;
