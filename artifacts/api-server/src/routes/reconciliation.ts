import { Router } from "express";
import { db } from "@workspace/db";
import {
  reconciliationJobsTable, bankStatementRowsTable, reconciliationMatchesTable,
  auditLogsTable, transactionsTable, invoicesTable,
} from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { parseGstr2aData, calculateReconciledITC } from "../lib/gstr2a-matcher";

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

// ──────────────────────────────────────────────────────────────────────────────
// Phase 3: GSTR-2A/2B Reconciliation Endpoints
// ──────────────────────────────────────────────────────────────────────────────

/**
 * POST /reconciliation/gstr2a
 *
 * Upload GSTR-2A data (JSON or flat array) and run the matching engine
 * against purchase invoices. Creates a reconciliation job with results.
 */
router.post("/reconciliation/gstr2a", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { name, gstr2aData } = req.body;
    if (!name || !gstr2aData) {
      res.status(400).json({ error: "Validation error", message: "name and gstr2aData required" });
      return;
    }

    // Parse the uploaded GSTR-2A data
    const gstr2aRows = parseGstr2aData(gstr2aData);

    if (gstr2aRows.length === 0) {
      res.status(400).json({ error: "No rows", message: "GSTR-2A data contained 0 parsable rows" });
      return;
    }

    // Fetch only this user's purchase invoices for matching
    const allInvoices = await db.select().from(invoicesTable).where(eq(invoicesTable.userId, req.userId!));
    const purchaseInvoices = allInvoices.filter(i => i.type === "purchase");

    // Run the matching engine
    const reconciliation = calculateReconciledITC(gstr2aRows, purchaseInvoices);

    // Create a reconciliation job record
    const [job] = await db.insert(reconciliationJobsTable).values({
      userId: req.userId!,
      name,
      bankName: "GSTR-2A",
      totalRows: gstr2aRows.length,
      matchedRows: reconciliation.matchedCount,
      unmatchedRows: reconciliation.unmatchedCount,
      pendingRows: reconciliation.mismatchCount,
      status: reconciliation.mismatchCount > 0 ? "review" : "completed",
      metadata: {
        type: "gstr2a",
        eligibleITC: reconciliation.eligibleITC,
        disputedITC: reconciliation.disputedITC,
        blockedITC: reconciliation.blockedITC,
        yourTotalITC: reconciliation.yourTotalITC,
        itcGap: reconciliation.itcGap,
        matchResults: reconciliation.matches.map(m => ({
          status: m.status,
          confidence: m.confidence,
          reason: m.reason,
          supplierGstin: m.gstr2aRow.supplierGstin,
          invoiceNumber: m.gstr2aRow.invoiceNumber,
          gstr2aGst: m.gstr2aRow.gstAmount,
          yourGst: m.matchedInvoice ? parseFloat(m.matchedInvoice.gstAmount) : null,
          amountDifference: m.amountDifference,
          itcClaimable: m.itcClaimable,
          matchedInvoiceId: m.matchedInvoice?.id ?? null,
          matchedInvoiceNumber: m.matchedInvoice?.invoiceNumber ?? null,
        })),
      },
    }).returning();

    // Store individual match records for the approve/reject flow
    for (const match of reconciliation.matches) {
      if (match.matchedInvoice) {
        // Store as bank_statement_row + reconciliation_match for consistency
        const [row] = await db.insert(bankStatementRowsTable).values({
          reconciliationJobId: job.id,
          rowIndex: match.gstr2aRow.rowIndex ?? 0,
          description: `${match.gstr2aRow.supplierName || match.gstr2aRow.supplierGstin} — ${match.gstr2aRow.invoiceNumber}`,
          reference: match.gstr2aRow.supplierGstin,
          credit: match.gstr2aRow.gstAmount,
          normalizedDescription: match.gstr2aRow.supplierGstin.toLowerCase(),
          status: match.status === "matched" ? "matched" : "pending_review",
        }).returning();

        await db.insert(reconciliationMatchesTable).values({
          reconciliationJobId: job.id,
          bankRowId: row.id,
          matchedEntityType: "invoice",
          matchedEntityId: String(match.matchedInvoice.id),
          matchType: "auto",
          confidenceScore: match.confidence,
          matchReason: match.reason,
          status: match.status === "matched" ? "approved" : "pending",
        });
      }
    }

    await db.insert(auditLogsTable).values({
      userId: req.userId!,
      action: "gstr2a_reconciliation",
      entity: "reconciliation_job",
      entityId: String(job.id),
      description: `GSTR-2A reconciliation: ${reconciliation.matchedCount} matched, ${reconciliation.mismatchCount} mismatched, ${reconciliation.unmatchedCount} unmatched`,
    });

    res.status(201).json({
      job,
      reconciliation: {
        totalRows: reconciliation.totalRows,
        matchedCount: reconciliation.matchedCount,
        mismatchCount: reconciliation.mismatchCount,
        unmatchedCount: reconciliation.unmatchedCount,
        eligibleITC: reconciliation.eligibleITC,
        disputedITC: reconciliation.disputedITC,
        blockedITC: reconciliation.blockedITC,
        yourTotalITC: reconciliation.yourTotalITC,
        itcGap: reconciliation.itcGap,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(400).json({ error: "GSTR-2A processing failed", message });
  }
});

/**
 * GET /reconciliation/itc-summary
 *
 * Returns the latest GSTR-2A reconciliation ITC summary.
 * If no GSTR-2A job exists, falls back to a basic ITC estimate from purchase invoices.
 */
router.get("/reconciliation/itc-summary", requireAuth, async (req: AuthRequest, res) => {
  // Find the most recent GSTR-2A reconciliation job
  const jobs = await db.select().from(reconciliationJobsTable)
    .where(eq(reconciliationJobsTable.userId, req.userId!))
    .orderBy(desc(reconciliationJobsTable.createdAt));

  const gstr2aJob = jobs.find(j => {
    const meta = j.metadata as Record<string, unknown> | null;
    return meta?.type === "gstr2a";
  });

  if (gstr2aJob) {
    const meta = gstr2aJob.metadata as Record<string, unknown>;
    res.json({
      source: "gstr2a_reconciliation",
      jobId: gstr2aJob.id,
      jobName: gstr2aJob.name,
      createdAt: gstr2aJob.createdAt,
      status: gstr2aJob.status,
      eligibleITC: meta.eligibleITC,
      disputedITC: meta.disputedITC,
      blockedITC: meta.blockedITC,
      yourTotalITC: meta.yourTotalITC,
      itcGap: meta.itcGap,
      matchedCount: gstr2aJob.matchedRows,
      mismatchCount: gstr2aJob.pendingRows,
      unmatchedCount: gstr2aJob.unmatchedRows,
    });
  } else {
    // No GSTR-2A reconciliation yet — return basic estimate
    const allInvoices = await db.select().from(invoicesTable).where(eq(invoicesTable.userId, req.userId!));
    const purchaseInvoices = allInvoices.filter(i => i.type === "purchase");
    const eligibleInvoices = purchaseInvoices.filter(i => {
      const gstin = i.sellerGstin;
      return gstin && gstin.trim().length === 15;
    });
    const totalITC = purchaseInvoices.reduce((s, i) => s + parseFloat(i.gstAmount), 0);
    const eligibleITC = eligibleInvoices.reduce((s, i) => s + parseFloat(i.gstAmount), 0);

    res.json({
      source: "estimate",
      eligibleITC,
      disputedITC: 0,
      blockedITC: totalITC - eligibleITC,
      yourTotalITC: totalITC,
      itcGap: totalITC - eligibleITC,
      matchedCount: 0,
      mismatchCount: 0,
      unmatchedCount: 0,
      message: "No GSTR-2A reconciliation performed yet. Upload GSTR-2A data for accurate ITC verification.",
    });
  }
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
