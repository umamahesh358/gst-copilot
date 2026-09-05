import { Router } from "express";
import { db } from "@workspace/db";
import { tasksTable, auditLogsTable } from "@workspace/db";
import { eq, desc, and, lte } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/tasks", requireAuth, async (req: AuthRequest, res) => {
  const { status, priority, module } = req.query as Record<string, string>;
  const conditions = [eq(tasksTable.userId, req.userId!)];
  if (status) conditions.push(eq(tasksTable.status, status));
  if (priority) conditions.push(eq(tasksTable.priority, priority));
  if (module) conditions.push(eq(tasksTable.module, module));

  const items = await db.select().from(tasksTable)
    .where(and(...conditions))
    .orderBy(desc(tasksTable.createdAt))
    .limit(100);
  res.json({ tasks: items });
});

router.get("/tasks/due-soon", requireAuth, async (req: AuthRequest, res) => {
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 7);
  const items = await db.select().from(tasksTable).where(
    and(
      eq(tasksTable.userId, req.userId!),
      eq(tasksTable.status, "open"),
      lte(tasksTable.dueDate, horizon)
    )
  ).orderBy(tasksTable.dueDate).limit(20);
  res.json({ tasks: items });
});

// ── Bug #13 Fix: stats/summary MUST be before /:id ─────────────────────────
router.get("/tasks/stats/summary", requireAuth, async (req: AuthRequest, res) => {
  const all = await db.select().from(tasksTable).where(eq(tasksTable.userId, req.userId!));
  const open = all.filter(t => t.status === "open").length;
  const completed = all.filter(t => t.status === "completed").length;
  const overdue = all.filter(t => t.status === "open" && t.dueDate && new Date(t.dueDate) < new Date()).length;
  const high = all.filter(t => t.status === "open" && t.priority === "high").length;
  res.json({ summary: { total: all.length, open, completed, overdue, high } });
});

router.post("/tasks", requireAuth, async (req: AuthRequest, res) => {
  const { title, description, module, entityType, entityId, priority, dueDate, reminderAt, assignedToUserId, tags } = req.body;
  if (!title) {
    res.status(400).json({ error: "Validation error", message: "title required" });
    return;
  }
  const [task] = await db.insert(tasksTable).values({
    userId: req.userId!,
    title, description,
    module: module ?? null,
    entityType: entityType ?? null,
    entityId: entityId ? String(entityId) : null,
    priority: priority ?? "normal",
    status: "open",
    source: req.body.source ?? "manual",
    dueDate: dueDate ? new Date(dueDate) : null,
    reminderAt: reminderAt ? new Date(reminderAt) : null,
    assignedToUserId: assignedToUserId ?? null,
    tags: tags ?? null,
  }).returning();
  res.status(201).json({ task });
});

// ── Bug #5 Fix: parseInt(String()) to handle string | string[] ──────────────
router.get("/tasks/:id", requireAuth, async (req: AuthRequest, res) => {
  const [task] = await db.select().from(tasksTable).where(
    and(eq(tasksTable.id, parseInt(String(req.params.id))), eq(tasksTable.userId, req.userId!))
  );
  if (!task) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ task });
});

router.put("/tasks/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id));
  const { title, description, priority, status, dueDate, reminderAt, assignedToUserId, tags } = req.body;
  const [task] = await db.update(tasksTable).set({
    title, description, priority, status,
    dueDate: dueDate ? new Date(dueDate) : undefined,
    reminderAt: reminderAt ? new Date(reminderAt) : undefined,
    assignedToUserId: assignedToUserId ?? undefined,
    tags: tags ?? undefined,
    completedAt: status === "completed" ? new Date() : undefined,
    updatedAt: new Date(),
  }).where(and(eq(tasksTable.id, id), eq(tasksTable.userId, req.userId!))).returning();
  res.json({ task });
});

router.post("/tasks/:id/complete", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id));
  const [task] = await db.update(tasksTable).set({
    status: "completed", completedAt: new Date(), updatedAt: new Date(),
  }).where(and(eq(tasksTable.id, id), eq(tasksTable.userId, req.userId!))).returning();
  res.json({ task });
});

router.delete("/tasks/:id", requireAuth, async (req: AuthRequest, res) => {
  await db.delete(tasksTable).where(
    and(eq(tasksTable.id, parseInt(String(req.params.id))), eq(tasksTable.userId, req.userId!))
  );
  res.json({ success: true });
});

export default router;
