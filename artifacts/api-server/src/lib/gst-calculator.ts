/**
 * GST Calculator Service — Indian GST Law-Compliant Calculations
 *
 * This service provides accurate GST/ITC computations following Indian GST law:
 * - Output GST from sale invoices
 * - Input Tax Credit with eligibility filtering (GSTIN check, blocked credits, time limit)
 * - ITC breakdown by GST rate slab (5%, 12%, 18%, 28%)
 * - CGST/SGST/IGST component split based on seller/buyer state
 *
 * Used by: dashboard.ts, gst-report endpoints
 */

import type { Invoice, InvoiceItem } from "@workspace/db";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface GstSummary {
  outputGst: number;
  inputGst: number;
  netGstPayable: number;
  excessITC: number;
  totalSaleInvoices: number;
  totalPurchaseInvoices: number;
  eligiblePurchaseInvoices: number;
  ineligiblePurchaseInvoices: number;
  blockedCreditAmount: number;
  expiredCreditAmount: number;
}

export interface GstRateSlabBreakdown {
  rate: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalGst: number;
  invoiceCount: number;
}

export interface GstComponentSplit {
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

export interface ITCEligibilityResult {
  eligible: boolean;
  reason?: string;
  invoiceId: number;
  gstAmount: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

/** Standard Indian GST rate slabs */
export const GST_RATE_SLABS = [0, 5, 12, 18, 28] as const;

/**
 * Blocked credit categories under Section 17(5) of CGST Act.
 * ITC cannot be claimed on purchases in these categories.
 *
 * Reference: https://www.cbic.gov.in/resources/htdocs-cbec/gst/cgst-act.pdf (Section 17(5))
 */
export const BLOCKED_CREDIT_CATEGORIES = [
  // Motor vehicles and conveyances (except when used for specified purposes)
  "vehicle", "car", "motor", "automobile", "conveyance",
  // Food, beverages, outdoor catering
  "food", "beverage", "catering", "restaurant", "meal",
  // Club or fitness memberships
  "club", "membership", "fitness", "gym", "sports",
  // Beauty treatment, health services, cosmetic surgery
  "beauty", "cosmetic", "salon", "spa",
  // Life/health insurance (except when obligatory)
  "life_insurance", "health_insurance",
  // Travel benefits to employees
  "travel_benefit", "leave_travel",
  // Works contract services for construction of immovable property
  "construction", "works_contract",
  // Goods/services for personal consumption
  "personal", "gift", "donation",
] as const;

/**
 * Indian GSTIN regex pattern.
 * Format: 2-digit state code + 10-char PAN + 1 entity number + Z + 1 checksum
 */
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/** Maximum age for ITC claims: 2 years from invoice date */
const ITC_TIME_LIMIT_YEARS = 2;

// ──────────────────────────────────────────────────────────────────────────────
// Core Functions
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Calculates total Output GST from sale invoices.
 * Output GST = GST you charged your customers (money collected for govt).
 * Per GSTR-1 rules, ALL sale invoices are included regardless of payment status.
 */
export function calculateOutputGst(invoices: Invoice[]): number {
  return invoices
    .filter(i => i.type !== "purchase")
    .reduce((sum, i) => sum + parseFloat(i.gstAmount), 0);
}

/**
 * Checks whether a single purchase invoice is eligible for ITC.
 * Returns { eligible, reason } for each invoice.
 *
 * Rules applied:
 * 1. Supplier must have a valid 15-character GSTIN
 * 2. Invoice category must NOT be in the blocked credits list (Section 17(5))
 * 3. Invoice must be within the 2-year time limit for ITC claims
 */
export function checkITCEligibility(
  invoice: Invoice,
  category?: string | null
): ITCEligibilityResult {
  const gstAmount = parseFloat(invoice.gstAmount);

  // Rule 1: Supplier must have a valid GSTIN
  const sellerGstin = invoice.sellerGstin;
  if (!sellerGstin || sellerGstin.trim().length === 0) {
    return { eligible: false, reason: "No supplier GSTIN recorded", invoiceId: invoice.id, gstAmount };
  }
  if (!GSTIN_REGEX.test(sellerGstin.trim().toUpperCase())) {
    return { eligible: false, reason: "Invalid supplier GSTIN format", invoiceId: invoice.id, gstAmount };
  }

  // Rule 2: Not a blocked credit category (Section 17(5))
  if (category) {
    const normalizedCategory = category.toLowerCase().replace(/[\s\-_]+/g, "_");
    const isBlocked = BLOCKED_CREDIT_CATEGORIES.some(
      blocked => normalizedCategory.includes(blocked)
    );
    if (isBlocked) {
      return { eligible: false, reason: `Blocked credit: Section 17(5) — "${category}"`, invoiceId: invoice.id, gstAmount };
    }
  }

  // Rule 3: Within 2-year time limit
  const invoiceDate = new Date(invoice.createdAt);
  const cutoffDate = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - ITC_TIME_LIMIT_YEARS);
  if (invoiceDate < cutoffDate) {
    return { eligible: false, reason: "Expired: invoice older than 2 years", invoiceId: invoice.id, gstAmount };
  }

  return { eligible: true, invoiceId: invoice.id, gstAmount };
}

/**
 * Calculates eligible Input Tax Credit from purchase invoices.
 * Applies all 3 eligibility rules and returns both the total ITC
 * and a breakdown of why ineligible invoices were rejected.
 */
export function calculateEligibleITC(
  invoices: Invoice[],
  categoryMap?: Map<number, string>
): {
  eligibleAmount: number;
  blockedAmount: number;
  expiredAmount: number;
  noGstinAmount: number;
  results: ITCEligibilityResult[];
} {
  const purchaseInvoices = invoices.filter(i => i.type === "purchase");

  let eligibleAmount = 0;
  let blockedAmount = 0;
  let expiredAmount = 0;
  let noGstinAmount = 0;
  const results: ITCEligibilityResult[] = [];

  for (const invoice of purchaseInvoices) {
    const category = categoryMap?.get(invoice.id) ?? null;
    const result = checkITCEligibility(invoice, category);
    results.push(result);

    if (result.eligible) {
      eligibleAmount += result.gstAmount;
    } else if (result.reason?.includes("Blocked credit")) {
      blockedAmount += result.gstAmount;
    } else if (result.reason?.includes("Expired")) {
      expiredAmount += result.gstAmount;
    } else {
      noGstinAmount += result.gstAmount;
    }
  }

  return { eligibleAmount, blockedAmount, expiredAmount, noGstinAmount, results };
}

/**
 * Calculates full GST summary combining output and input GST.
 * This is the primary function used by the dashboard API.
 */
export function calculateGstSummary(
  invoices: Invoice[],
  categoryMap?: Map<number, string>
): GstSummary {
  const outputGst = calculateOutputGst(invoices);
  const itcResult = calculateEligibleITC(invoices, categoryMap);

  const purchaseInvoices = invoices.filter(i => i.type === "purchase");
  const eligibleCount = itcResult.results.filter(r => r.eligible).length;

  return {
    outputGst,
    inputGst: itcResult.eligibleAmount,
    netGstPayable: Math.max(0, outputGst - itcResult.eligibleAmount),
    excessITC: Math.max(0, itcResult.eligibleAmount - outputGst),
    totalSaleInvoices: invoices.filter(i => i.type !== "purchase").length,
    totalPurchaseInvoices: purchaseInvoices.length,
    eligiblePurchaseInvoices: eligibleCount,
    ineligiblePurchaseInvoices: purchaseInvoices.length - eligibleCount,
    blockedCreditAmount: itcResult.blockedAmount,
    expiredCreditAmount: itcResult.expiredAmount,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Rate Slab Breakdown
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Breaks down GST amounts by rate slab (0%, 5%, 12%, 18%, 28%).
 * Uses invoice_items data for precise per-item rates.
 *
 * @param items - All invoice items from the invoices being analyzed
 * @param invoices - The parent invoices (for CGST/SGST/IGST determination)
 */
export function getITCByGstRate(
  items: InvoiceItem[],
  invoices: Invoice[]
): GstRateSlabBreakdown[] {
  // Build a map of invoice ID → invoice for quick lookup
  const invoiceMap = new Map(invoices.map(i => [i.id, i]));

  return GST_RATE_SLABS.map(rate => {
    // Find items matching this rate slab (round to nearest integer for matching)
    const matchingItems = items.filter(item => {
      const itemRate = Math.round(parseFloat(item.gstRate));
      return itemRate === rate;
    });

    // Calculate totals for this slab
    const taxableValue = matchingItems.reduce(
      (sum, item) => sum + parseFloat(item.unitPrice) * item.quantity, 0
    );
    const totalGst = matchingItems.reduce(
      (sum, item) => sum + parseFloat(item.gstAmount), 0
    );

    // Determine CGST/SGST vs IGST split
    // For each item, check parent invoice's seller/buyer GSTIN state codes
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    for (const item of matchingItems) {
      const invoice = invoiceMap.get(item.invoiceId);
      if (!invoice) continue;

      const itemGst = parseFloat(item.gstAmount);
      const split = getGstComponentSplit(
        itemGst,
        invoice.sellerGstin,
        invoice.buyerGstin
      );
      cgst += split.cgst;
      sgst += split.sgst;
      igst += split.igst;
    }

    // Count unique invoices that contain items at this rate
    const uniqueInvoiceIds = new Set(matchingItems.map(item => item.invoiceId));

    return {
      rate,
      taxableValue,
      cgst,
      sgst,
      igst,
      totalGst,
      invoiceCount: uniqueInvoiceIds.size,
    };
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// CGST / SGST / IGST Split
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Extracts the 2-digit state code from a GSTIN.
 * Returns null if invalid.
 */
function extractStateCode(gstin: string | null | undefined): string | null {
  if (!gstin || gstin.trim().length < 2) return null;
  const code = gstin.trim().substring(0, 2);
  // State codes are 01-38, 97, 99
  if (!/^[0-9]{2}$/.test(code)) return null;
  return code;
}

/**
 * Splits a total GST amount into CGST + SGST (intra-state) or IGST (inter-state).
 *
 * - Intra-state (same state code): CGST = GST/2, SGST = GST/2, IGST = 0
 * - Inter-state (different state code): CGST = 0, SGST = 0, IGST = GST
 * - If either GSTIN is missing/invalid: defaults to CGST + SGST (intra-state)
 */
export function getGstComponentSplit(
  totalGstAmount: number,
  sellerGstin: string | null | undefined,
  buyerGstin: string | null | undefined
): GstComponentSplit {
  const sellerState = extractStateCode(sellerGstin);
  const buyerState = extractStateCode(buyerGstin);

  // If either state code is unavailable, default to intra-state (CGST+SGST)
  if (!sellerState || !buyerState) {
    return {
      cgst: totalGstAmount / 2,
      sgst: totalGstAmount / 2,
      igst: 0,
      total: totalGstAmount,
    };
  }

  if (sellerState === buyerState) {
    // Intra-state: CGST + SGST (equal halves)
    return {
      cgst: totalGstAmount / 2,
      sgst: totalGstAmount / 2,
      igst: 0,
      total: totalGstAmount,
    };
  } else {
    // Inter-state: full IGST
    return {
      cgst: 0,
      sgst: 0,
      igst: totalGstAmount,
      total: totalGstAmount,
    };
  }
}

/**
 * Calculates aggregate CGST/SGST/IGST split across all invoices.
 * Used for GST report overview cards.
 */
export function getAggregateGstSplit(invoices: Invoice[]): GstComponentSplit {
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  let total = 0;

  for (const invoice of invoices) {
    const gstAmount = parseFloat(invoice.gstAmount);
    if (gstAmount <= 0) continue;

    const split = getGstComponentSplit(gstAmount, invoice.sellerGstin, invoice.buyerGstin);
    cgst += split.cgst;
    sgst += split.sgst;
    igst += split.igst;
    total += gstAmount;
  }

  return { cgst, sgst, igst, total };
}
