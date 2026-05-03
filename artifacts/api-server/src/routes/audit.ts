import { Router } from "express";
import { db } from "@workspace/db";
import { auditLogsTable } from "@workspace/db";
import { eq, desc, and, gte, ilike } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/audit-logs", requireAuth, async (req: AuthRequest, res) => {
  const {
    entity,
    action,
    from,
    limit: limitQ,
    offset: offsetQ,
  } = req.query as Record<string, string | undefined>;

  const limit = Math.min(parseInt(limitQ ?? "50"), 200);
  const offset = parseInt(offsetQ ?? "0");

  const conditions = [eq(auditLogsTable.userId, req.userId!)];
  if (entity) conditions.push(eq(auditLogsTable.entity, entity));
  if (action) conditions.push(eq(auditLogsTable.action, action));
  if (from) conditions.push(gte(auditLogsTable.createdAt, new Date(from)));

  const logs = await db
    .select()
    .from(auditLogsTable)
    .where(and(...conditions))
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json({ logs, limit, offset });
});

export default router;
