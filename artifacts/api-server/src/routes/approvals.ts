import { Router } from "express";
import { db } from "@workspace/db";
import { approvalRequestsTable, auditLogsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/approvals", requireAuth, async (req: AuthRequest, res) => {
  const { status } = req.query as { status?: string };
  const conditions = [
    eq(approvalRequestsTable.requestedByUserId, req.userId!),
  ];
  if (status) conditions.push(eq(approvalRequestsTable.status, status));

  const items = await db
    .select()
    .from(approvalRequestsTable)
    .where(and(...conditions))
    .orderBy(desc(approvalRequestsTable.createdAt));

  res.json({ approvals: items });
});

router.get("/approvals/pending", requireAuth, async (req: AuthRequest, res) => {
  const items = await db
    .select()
    .from(approvalRequestsTable)
    .where(
      and(
        eq(approvalRequestsTable.requestedByUserId, req.userId!),
        eq(approvalRequestsTable.status, "pending")
      )
    )
    .orderBy(desc(approvalRequestsTable.createdAt));

  res.json({ approvals: items, count: items.length });
});

router.post("/approvals", requireAuth, async (req: AuthRequest, res) => {
  const { entityType, entityId, action, title, description, priority, payload, assignedToUserId, dueDate } = req.body;
  if (!entityType || !entityId || !action || !title) {
    res.status(400).json({ error: "Validation error", message: "entityType, entityId, action, and title are required" });
    return;
  }

  const [approval] = await db
    .insert(approvalRequestsTable)
    .values({
      requestedByUserId: req.userId!,
      assignedToUserId: assignedToUserId ?? null,
      entityType,
      entityId: String(entityId),
      action,
      title,
      description,
      priority: priority ?? "normal",
      status: "pending",
      payload,
      dueDate: dueDate ? new Date(dueDate) : null,
    })
    .returning();

  res.status(201).json({ approval });
});

router.post("/approvals/:id/approve", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  const { comments } = req.body;
  const [approval] = await db
    .update(approvalRequestsTable)
    .set({ status: "approved", comments, reviewedAt: new Date(), updatedAt: new Date() })
    .where(eq(approvalRequestsTable.id, id))
    .returning();

  if (!approval) {
    res.status(404).json({ error: "Not found", message: "Approval not found" });
    return;
  }

  await db.insert(auditLogsTable).values({
    userId: req.userId!,
    action: "approval_approved",
    entity: "approval_request",
    entityId: String(id),
    description: `Approval approved: ${approval.title}`,
  });

  res.json({ approval });
});

router.post("/approvals/:id/reject", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  const { comments } = req.body;
  const [approval] = await db
    .update(approvalRequestsTable)
    .set({ status: "rejected", comments, reviewedAt: new Date(), updatedAt: new Date() })
    .where(eq(approvalRequestsTable.id, id))
    .returning();

  if (!approval) {
    res.status(404).json({ error: "Not found", message: "Approval not found" });
    return;
  }

  await db.insert(auditLogsTable).values({
    userId: req.userId!,
    action: "approval_rejected",
    entity: "approval_request",
    entityId: String(id),
    description: `Approval rejected: ${approval.title}`,
  });

  res.json({ approval });
});

export default router;
