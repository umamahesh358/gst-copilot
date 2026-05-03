import { Router } from "express";
import { db } from "@workspace/db";
import {
  reconciliationJobsTable, bankStatementRowsTable, reconciliationMatchesTable,
  auditLogsTable, transactionsTable, invoicesTable,
} from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/reconciliation/jobs", requireAuth, async (req: AuthRequest, res) => {
  const jobs = await db.select().from(reconciliationJobsTable)
    .where(eq(reconciliationJobsTable.userId, req.userId!))
    .orderBy(desc(reconciliationJobsTable.createdAt));
  res.json({ jobs });
});

router.post("/reconciliation/jobs", requireAuth, async (req: AuthRequest, res) => {
  const { name, bankName, accountNumber, rows } = req.body;
  if (!name || !rows || !Array.isArray(rows)) {
    res.status(400).json({ error: "Validation error", message: "name and rows[] required" });
    return;
  }

  const [job] = await db.insert(reconciliationJobsTable).values({
    userId: req.userId!,
    name,
    bankName: bankName ?? null,
    accountNumber: accountNumber ?? null,
    totalRows: rows.length,
    pendingRows: rows.length,
    status: "processing",
  }).returning();

  const statementRows = await db.insert(bankStatementRowsTable).values(
    rows.map((r: Record<string, unknown>, i: number) => ({
      reconciliationJobId: job.id,
      rowIndex: i,
      transactionDate: r.date ? new Date(r.date as string) : null,
      description: r.description as string ?? "",
      reference: r.reference as string ?? null,
      debit: r.debit ? parseFloat(r.debit as string) : null,
      credit: r.credit ? parseFloat(r.credit as string) : null,
      balance: r.balance ? parseFloat(r.balance as string) : null,
      normalizedDescription: String(r.description ?? "").toLowerCase().trim(),
      status: "unmatched",
    }))
  ).returning();

  const matches = await generateMatches(job.id, statementRows, req.userId!);

  await db.update(reconciliationJobsTable).set({
    status: "review",
    matchedRows: matches.length,
    pendingRows: rows.length - matches.length,
    updatedAt: new Date(),
  }).where(eq(reconciliationJobsTable.id, job.id));

  res.status(201).json({ job: { ...job, status: "review" }, rows: statementRows.length, autoMatched: matches.length });
});

router.get("/reconciliation/jobs/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const [job] = await db.select().from(reconciliationJobsTable).where(
    and(eq(reconciliationJobsTable.id, id), eq(reconciliationJobsTable.userId, req.userId!))
  );
  if (!job) { res.status(404).json({ error: "Not found" }); return; }

  const rows = await db.select().from(bankStatementRowsTable)
    .where(eq(bankStatementRowsTable.reconciliationJobId, id))
    .orderBy(bankStatementRowsTable.rowIndex);

  const matches = await db.select().from(reconciliationMatchesTable)
    .where(eq(reconciliationMatchesTable.reconciliationJobId, id));

  res.json({ job, rows, matches });
});

router.get("/reconciliation/jobs/:id/queue", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const rows = await db.select().from(bankStatementRowsTable)
    .where(and(eq(bankStatementRowsTable.reconciliationJobId, id), eq(bankStatementRowsTable.status, "unmatched")));
  const matches = await db.select().from(reconciliationMatchesTable)
    .where(and(eq(reconciliationMatchesTable.reconciliationJobId, id), eq(reconciliationMatchesTable.status, "pending")));
  res.json({ unmatchedRows: rows, pendingMatches: matches });
});

router.post("/reconciliation/matches/:matchId/approve", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.matchId);
  const [match] = await db.update(reconciliationMatchesTable).set({
    status: "approved",
    reviewedByUserId: req.userId!,
    reviewedAt: new Date(),
    reviewNote: req.body.note ?? null,
  }).where(eq(reconciliationMatchesTable.id, id)).returning();

  await db.update(bankStatementRowsTable).set({ status: "matched" })
    .where(eq(bankStatementRowsTable.id, match.bankRowId));

  await db.insert(auditLogsTable).values({
    userId: req.userId!,
    action: "approve",
    entity: "reconciliation_match",
    entityId: String(id),
    description: `Approved reconciliation match for ${match.matchedEntityType} ${match.matchedEntityId}`,
  });

  res.json({ match });
});

router.post("/reconciliation/matches/:matchId/reject", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.matchId);
  const [match] = await db.update(reconciliationMatchesTable).set({
    status: "rejected",
    reviewedByUserId: req.userId!,
    reviewedAt: new Date(),
    reviewNote: req.body.note ?? null,
  }).where(eq(reconciliationMatchesTable.id, id)).returning();

  await db.update(bankStatementRowsTable).set({ status: "unmatched" })
    .where(eq(bankStatementRowsTable.id, match.bankRowId));

  res.json({ match });
});

router.post("/reconciliation/matches", requireAuth, async (req: AuthRequest, res) => {
  const { bankRowId, matchedEntityType, matchedEntityId, reconciliationJobId } = req.body;
  if (!bankRowId || !matchedEntityType || !matchedEntityId || !reconciliationJobId) {
    res.status(400).json({ error: "Validation error", message: "bankRowId, matchedEntityType, matchedEntityId, reconciliationJobId required" });
    return;
  }
  const [match] = await db.insert(reconciliationMatchesTable).values({
    reconciliationJobId,
    bankRowId,
    matchedEntityType,
    matchedEntityId: String(matchedEntityId),
    matchType: "manual",
    confidenceScore: 1.0,
    status: "approved",
    reviewedByUserId: req.userId!,
    reviewedAt: new Date(),
  }).returning();
  await db.update(bankStatementRowsTable).set({ status: "matched" }).where(eq(bankStatementRowsTable.id, bankRowId));
  res.status(201).json({ match });
});

router.get("/reconciliation/summary", requireAuth, async (req: AuthRequest, res) => {
  const jobs = await db.select().from(reconciliationJobsTable).where(eq(reconciliationJobsTable.userId, req.userId!));
  const total = jobs.length;
  const completed = jobs.filter(j => j.status === "completed").length;
  const inReview = jobs.filter(j => j.status === "review").length;
  const totalMatched = jobs.reduce((s, j) => s + j.matchedRows, 0);
  const totalUnmatched = jobs.reduce((s, j) => s + j.unmatchedRows, 0);
  res.json({ summary: { total, completed, inReview, totalMatched, totalUnmatched } });
});

async function generateMatches(jobId: number, rows: typeof bankStatementRowsTable.$inferSelect[], _userId: number) {
  const transactions = await db.select().from(transactionsTable);
  const matches: typeof reconciliationMatchesTable.$inferInsert[] = [];

  for (const row of rows) {
    const amount = row.credit ?? row.debit ?? 0;
    const txMatch = transactions.find(t => {
      const txAmount = parseFloat(t.amount as unknown as string ?? "0");
      const amountClose = Math.abs(Math.abs(txAmount) - amount) < 0.01;
      const descSimilar = row.normalizedDescription &&
        (t.description?.toLowerCase().includes(row.normalizedDescription.slice(0, 6)) ?? false);
      return amountClose && descSimilar;
    });
    if (txMatch) {
      matches.push({
        reconciliationJobId: jobId,
        bankRowId: row.id,
        matchedEntityType: "transaction",
        matchedEntityId: String(txMatch.id),
        matchType: "auto",
        confidenceScore: 0.9,
        matchReason: "Amount and description match",
        status: "pending",
      });
    }
  }

  if (matches.length > 0) {
    await db.insert(reconciliationMatchesTable).values(matches);
    for (const m of matches) {
      await db.update(bankStatementRowsTable).set({ status: "pending_review" })
        .where(eq(bankStatementRowsTable.id, m.bankRowId!));
    }
  }
  return matches;
}

export default router;
