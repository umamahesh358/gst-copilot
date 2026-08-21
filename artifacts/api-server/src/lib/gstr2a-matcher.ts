/**
 * GSTR-2A/2B Reconciliation Matching Engine
 *
 * Matches government-filed supplier data (GSTR-2A downloaded from GST portal)
 * against your purchase invoices stored in the database.
 *
 * Match logic:
 *   1. GSTIN match (supplier GSTIN on your invoice = GSTIN in GSTR-2A row)
 *   2. Invoice number match (fuzzy — ignores case, spaces, leading zeros)
 *   3. Amount match (within ±1% tolerance for rounding differences)
 *
 * Outputs:
 *   MATCHED   → Supplier filed, ITC 100% eligible
 *   UNMATCHED → Supplier didn't file (ITC temporarily blocked)
 *   MISMATCH  → Amount differs from government record (needs CA review)
 *
 * Used by: reconciliation.ts routes
 */

import type { Invoice } from "@workspace/db";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

/** A single row from the GSTR-2A/2B JSON/CSV downloaded from the GST portal */
export interface Gstr2aRow {
  /** Supplier GSTIN (15-char format) */
  supplierGstin: string;
  /** Supplier's trade name */
  supplierName?: string;
  /** Invoice number as filed by the supplier */
  invoiceNumber: string;
  /** Invoice date (ISO string or DD-MM-YYYY) */
  invoiceDate?: string;
  /** Taxable value (pre-GST amount) */
  taxableValue: number;
  /** Total GST amount (CGST + SGST or IGST) */
  gstAmount: number;
  /** IGST amount */
  igst?: number;
  /** CGST amount */
  cgst?: number;
  /** SGST amount */
  sgst?: number;
  /** GST rate percentage */
  gstRate?: number;
  /** Filing period (e.g. "042026" for April 2026) */
  filingPeriod?: string;
  /** Row index in the original file */
  rowIndex?: number;
}

/** Result of matching a single GSTR-2A row against your purchase invoices */
export interface Gstr2aMatchResult {
  /** The GSTR-2A row from the government file */
  gstr2aRow: Gstr2aRow;
  /** Match status */
  status: "matched" | "mismatch" | "unmatched";
  /** Your matching purchase invoice (if found) */
  matchedInvoice?: Invoice;
  /** Confidence score (0-1) */
  confidence: number;
  /** Human-readable reason for the match/mismatch */
  reason: string;
  /** Amount difference (negative = govt shows less, positive = govt shows more) */
  amountDifference?: number;
  /** ITC claimable from this row (only if matched) */
  itcClaimable: number;
}

/** Overall reconciliation summary after matching */
export interface Gstr2aReconciliationSummary {
  /** Total rows in the GSTR-2A file */
  totalRows: number;
  /** Rows that matched your purchase invoices */
  matchedCount: number;
  /** Rows with amount mismatches */
  mismatchCount: number;
  /** Rows where supplier filed but you have no matching invoice */
  unmatchedCount: number;
  /** ITC from fully matched invoices (100% claimable) */
  eligibleITC: number;
  /** ITC from mismatched invoices (needs CA review) */
  disputedITC: number;
  /** ITC from your invoices where supplier didn't file (blocked until filed) */
  blockedITC: number;
  /** Your total purchase invoice ITC (for comparison) */
  yourTotalITC: number;
  /** Difference between government data and your records */
  itcGap: number;
  /** All match results */
  matches: Gstr2aMatchResult[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

/** Amount tolerance for matching (±1% of the larger amount) */
const AMOUNT_TOLERANCE_PERCENT = 1;

/** Absolute minimum tolerance (₹1 for rounding differences) */
const AMOUNT_TOLERANCE_MIN = 1;

// ──────────────────────────────────────────────────────────────────────────────
// Parser
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Parses raw GSTR-2A data (JSON format from the GST portal export).
 *
 * The GST portal exports GSTR-2A in JSON format with nested structures.
 * This function normalizes it into a flat array of Gstr2aRow objects.
 *
 * Also accepts a simplified flat array format for manual/CSV imports.
 */
export function parseGstr2aData(rawData: unknown): Gstr2aRow[] {
  if (!rawData || typeof rawData !== "object") {
    throw new Error("Invalid GSTR-2A data: expected an object or array");
  }

  // Case 1: Already a flat array of rows (simplified format / CSV import)
  if (Array.isArray(rawData)) {
    return rawData.map((row, i) => normalizeGstr2aRow(row, i));
  }

  const data = rawData as Record<string, unknown>;

  // Case 2: GST portal JSON format — nested under b2b > inv structure
  if (data.b2b && Array.isArray(data.b2b)) {
    const rows: Gstr2aRow[] = [];
    let rowIndex = 0;

    for (const supplier of data.b2b as Record<string, unknown>[]) {
      const supplierGstin = (supplier.ctin as string) || "";
      const supplierName = (supplier.trdnm as string) || "";
      const invoices = (supplier.inv as Record<string, unknown>[]) || [];

      for (const inv of invoices) {
        const items = (inv.itms as Record<string, unknown>[]) || [];
        let totalGst = 0;
        let totalIgst = 0;
        let totalCgst = 0;
        let totalSgst = 0;
        let totalTaxable = 0;
        let gstRate = 0;

        for (const item of items) {
          const det = (item.itm_det as Record<string, unknown>) || {};
          totalTaxable += (det.txval as number) || 0;
          totalIgst += (det.iamt as number) || 0;
          totalCgst += (det.camt as number) || 0;
          totalSgst += (det.samt as number) || 0;
          gstRate = (det.rt as number) || gstRate;
        }

        totalGst = totalIgst + totalCgst + totalSgst;

        rows.push({
          supplierGstin,
          supplierName,
          invoiceNumber: (inv.inum as string) || "",
          invoiceDate: (inv.idt as string) || "",
          taxableValue: totalTaxable,
          gstAmount: totalGst,
          igst: totalIgst || undefined,
          cgst: totalCgst || undefined,
          sgst: totalSgst || undefined,
          gstRate: gstRate || undefined,
          filingPeriod: (data.fp as string) || undefined,
          rowIndex: rowIndex++,
        });
      }
    }

    return rows;
  }

  // Case 3: Wrapped in a data property
  if (data.data) {
    return parseGstr2aData(data.data);
  }

  throw new Error("Unrecognized GSTR-2A format. Expected b2b[] structure or flat array.");
}

/**
 * Normalizes a single raw row into a typed Gstr2aRow.
 */
function normalizeGstr2aRow(raw: Record<string, unknown>, index: number): Gstr2aRow {
  return {
    supplierGstin: String(raw.supplierGstin || raw.gstin || raw.ctin || "").trim().toUpperCase(),
    supplierName: String(raw.supplierName || raw.trdnm || raw.name || ""),
    invoiceNumber: String(raw.invoiceNumber || raw.inum || raw.invoice_number || "").trim(),
    invoiceDate: String(raw.invoiceDate || raw.idt || raw.invoice_date || ""),
    taxableValue: parseFloat(String(raw.taxableValue || raw.txval || raw.taxable_value || "0")),
    gstAmount: parseFloat(String(raw.gstAmount || raw.gst_amount || raw.total_gst || "0")),
    igst: raw.igst != null ? parseFloat(String(raw.igst || raw.iamt || "0")) : undefined,
    cgst: raw.cgst != null ? parseFloat(String(raw.cgst || raw.camt || "0")) : undefined,
    sgst: raw.sgst != null ? parseFloat(String(raw.sgst || raw.samt || "0")) : undefined,
    gstRate: raw.gstRate != null ? parseFloat(String(raw.gstRate || raw.rt || "0")) : undefined,
    filingPeriod: raw.filingPeriod ? String(raw.filingPeriod) : undefined,
    rowIndex: index,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Matching Engine
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Normalizes an invoice number for fuzzy matching.
 * Strips spaces, hyphens, leading zeros, and converts to uppercase.
 */
function normalizeInvoiceNumber(num: string): string {
  return num
    .toUpperCase()
    .replace(/[\s\-\/\\_.]+/g, "")  // Strip separators
    .replace(/^0+/, "");             // Strip leading zeros
}

/**
 * Checks if two amounts are within tolerance.
 * Uses ±1% of the larger amount, with a minimum tolerance of ₹1.
 */
function isAmountMatch(amount1: number, amount2: number): boolean {
  const larger = Math.max(Math.abs(amount1), Math.abs(amount2));
  const tolerance = Math.max(
    larger * (AMOUNT_TOLERANCE_PERCENT / 100),
    AMOUNT_TOLERANCE_MIN
  );
  return Math.abs(amount1 - amount2) <= tolerance;
}

/**
 * Matches GSTR-2A rows against your purchase invoices.
 *
 * Algorithm:
 *   For each GSTR-2A row:
 *     1. Find invoices with matching supplier GSTIN
 *     2. Among those, find the one with matching invoice number (fuzzy)
 *     3. If found, check if the GST amount matches within tolerance
 *        → MATCHED (exact) or MISMATCH (amount differs)
 *     4. If not found → UNMATCHED (supplier filed but you don't have the invoice)
 *
 * @param gstr2aRows — Parsed rows from GSTR-2A upload
 * @param purchaseInvoices — Your purchase invoices from the database
 */
export function matchGstr2aToInvoices(
  gstr2aRows: Gstr2aRow[],
  purchaseInvoices: Invoice[]
): Gstr2aMatchResult[] {
  // Build lookup indexes for fast matching
  const invoicesByGstin = new Map<string, Invoice[]>();
  for (const inv of purchaseInvoices) {
    const gstin = (inv.sellerGstin || "").trim().toUpperCase();
    if (!gstin) continue;
    if (!invoicesByGstin.has(gstin)) invoicesByGstin.set(gstin, []);
    invoicesByGstin.get(gstin)!.push(inv);
  }

  const results: Gstr2aMatchResult[] = [];
  const matchedInvoiceIds = new Set<number>();

  for (const row of gstr2aRows) {
    const gstin = row.supplierGstin.trim().toUpperCase();
    const normalizedRowInvNum = normalizeInvoiceNumber(row.invoiceNumber);

    // Step 1: Find invoices from the same supplier GSTIN
    const candidateInvoices = invoicesByGstin.get(gstin) || [];

    if (candidateInvoices.length === 0) {
      // Supplier GSTIN not found in any of your purchase invoices
      results.push({
        gstr2aRow: row,
        status: "unmatched",
        confidence: 0,
        reason: "Supplier GSTIN not found in your purchase invoices",
        itcClaimable: 0,
      });
      continue;
    }

    // Step 2: Find the invoice with matching invoice number
    let bestMatch: Invoice | undefined;
    let bestConfidence = 0;

    for (const inv of candidateInvoices) {
      if (matchedInvoiceIds.has(inv.id)) continue; // Already matched to another row

      const normalizedInvNum = normalizeInvoiceNumber(inv.invoiceNumber);

      // Exact invoice number match
      if (normalizedInvNum === normalizedRowInvNum) {
        bestMatch = inv;
        bestConfidence = 1.0;
        break;
      }

      // Partial match (one contains the other)
      if (normalizedInvNum.includes(normalizedRowInvNum) ||
          normalizedRowInvNum.includes(normalizedInvNum)) {
        if (bestConfidence < 0.8) {
          bestMatch = inv;
          bestConfidence = 0.8;
        }
      }
    }

    // If no invoice number match, try amount-only matching as last resort
    if (!bestMatch) {
      for (const inv of candidateInvoices) {
        if (matchedInvoiceIds.has(inv.id)) continue;
        const invGst = parseFloat(inv.gstAmount);
        if (isAmountMatch(invGst, row.gstAmount)) {
          bestMatch = inv;
          bestConfidence = 0.6;
          break;
        }
      }
    }

    if (!bestMatch) {
      // Supplier GSTIN exists but no matching invoice found
      results.push({
        gstr2aRow: row,
        status: "unmatched",
        confidence: 0,
        reason: "Supplier found but no matching invoice number or amount",
        itcClaimable: 0,
      });
      continue;
    }

    // Step 3: Check amount match
    matchedInvoiceIds.add(bestMatch.id);
    const invGstAmount = parseFloat(bestMatch.gstAmount);

    if (isAmountMatch(invGstAmount, row.gstAmount)) {
      // Full match — ITC is 100% eligible
      results.push({
        gstr2aRow: row,
        status: "matched",
        matchedInvoice: bestMatch,
        confidence: bestConfidence,
        reason: "GSTIN + invoice number + amount match",
        amountDifference: 0,
        itcClaimable: invGstAmount,
      });
    } else {
      // Amount mismatch — needs CA review
      const diff = row.gstAmount - invGstAmount;
      results.push({
        gstr2aRow: row,
        status: "mismatch",
        matchedInvoice: bestMatch,
        confidence: bestConfidence * 0.7,
        reason: `Amount mismatch: GSTR-2A shows ₹${row.gstAmount.toFixed(2)}, your invoice shows ₹${invGstAmount.toFixed(2)} (diff: ₹${diff.toFixed(2)})`,
        amountDifference: diff,
        itcClaimable: 0, // Disputed — not claimable until resolved
      });
    }
  }

  return results;
}

// ──────────────────────────────────────────────────────────────────────────────
// Reconciled ITC Calculation
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Calculates the full reconciliation summary including ITC breakdown.
 *
 * @param gstr2aRows — Parsed rows from GSTR-2A upload
 * @param purchaseInvoices — Your purchase invoices from the database
 */
export function calculateReconciledITC(
  gstr2aRows: Gstr2aRow[],
  purchaseInvoices: Invoice[]
): Gstr2aReconciliationSummary {
  const matches = matchGstr2aToInvoices(gstr2aRows, purchaseInvoices);

  const matchedResults = matches.filter(m => m.status === "matched");
  const mismatchResults = matches.filter(m => m.status === "mismatch");
  const unmatchedResults = matches.filter(m => m.status === "unmatched");

  // ITC from fully matched invoices (safe to claim)
  const eligibleITC = matchedResults.reduce((s, m) => s + m.itcClaimable, 0);

  // ITC from mismatched invoices (needs review before claiming)
  const disputedITC = mismatchResults.reduce((s, m) => {
    if (m.matchedInvoice) {
      return s + parseFloat(m.matchedInvoice.gstAmount);
    }
    return s;
  }, 0);

  // ITC from your invoices where the supplier hasn't filed in GSTR-2A
  // These are purchase invoices NOT present in the GSTR-2A file at all
  const matchedInvoiceIds = new Set(
    matches
      .filter(m => m.matchedInvoice)
      .map(m => m.matchedInvoice!.id)
  );
  const purchaseOnly = purchaseInvoices.filter(inv => inv.type === "purchase");
  const supplierNotFiled = purchaseOnly.filter(inv => !matchedInvoiceIds.has(inv.id));
  const blockedITC = supplierNotFiled.reduce(
    (s, inv) => s + parseFloat(inv.gstAmount), 0
  );

  // Your total purchase ITC (for comparison)
  const yourTotalITC = purchaseOnly.reduce(
    (s, inv) => s + parseFloat(inv.gstAmount), 0
  );

  return {
    totalRows: gstr2aRows.length,
    matchedCount: matchedResults.length,
    mismatchCount: mismatchResults.length,
    unmatchedCount: unmatchedResults.length,
    eligibleITC,
    disputedITC,
    blockedITC,
    yourTotalITC,
    itcGap: yourTotalITC - eligibleITC,
    matches,
  };
}
