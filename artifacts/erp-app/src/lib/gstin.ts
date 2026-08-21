/**
 * Indian GSTIN (Goods and Services Tax Identification Number) utilities.
 *
 * Format: 2-digit state code + 10-char PAN + 1 entity number + Z + 1 checksum
 * Example: 22AAAAA0000A1Z5
 * Total length: 15 characters
 */

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/**
 * Returns true if the given string is a validly formatted Indian GSTIN.
 * Does NOT verify against the GST portal — only checks the format.
 */
export function isValidGstin(gstin: string): boolean {
  if (!gstin || typeof gstin !== "string") return false;
  return GSTIN_REGEX.test(gstin.trim().toUpperCase());
}

/**
 * Returns the 2-digit state code from a valid GSTIN.
 * Returns null if the GSTIN is invalid.
 */
export function getStateCodeFromGstin(gstin: string): string | null {
  if (!isValidGstin(gstin)) return null;
  return gstin.substring(0, 2);
}

/**
 * Returns the PAN (10 chars) embedded in a valid GSTIN.
 * Returns null if the GSTIN is invalid.
 */
export function getPanFromGstin(gstin: string): string | null {
  if (!isValidGstin(gstin)) return null;
  return gstin.substring(2, 12);
}

/**
 * Returns true if two GSTINs belong to the same Indian state.
 * Used to determine intra-state (CGST+SGST) vs inter-state (IGST) GST.
 */
export function isSameState(gstin1: string, gstin2: string): boolean {
  const state1 = getStateCodeFromGstin(gstin1);
  const state2 = getStateCodeFromGstin(gstin2);
  if (!state1 || !state2) return false;
  return state1 === state2;
}

/**
 * Splits a total GST amount into CGST + SGST (intra-state) or IGST (inter-state).
 * Pass sellerGstin and buyerGstin to determine which applies.
 *
 * @returns { cgst, sgst, igst } — two of these will always be 0
 */
export function splitGstComponents(
  totalGstAmount: number,
  sellerGstin: string | null | undefined,
  buyerGstin: string | null | undefined
): { cgst: number; sgst: number; igst: number } {
  // If either GSTIN is missing/invalid, default to CGST+SGST split
  if (!sellerGstin || !buyerGstin || !isValidGstin(sellerGstin) || !isValidGstin(buyerGstin)) {
    return {
      cgst: totalGstAmount / 2,
      sgst: totalGstAmount / 2,
      igst: 0,
    };
  }

  if (isSameState(sellerGstin, buyerGstin)) {
    // Intra-state: CGST + SGST (equal halves)
    return {
      cgst: totalGstAmount / 2,
      sgst: totalGstAmount / 2,
      igst: 0,
    };
  } else {
    // Inter-state: full amount as IGST
    return {
      cgst: 0,
      sgst: 0,
      igst: totalGstAmount,
    };
  }
}

/**
 * Human-readable validation error message for GSTIN input fields.
 * Returns undefined if valid (no error).
 */
export function validateGstinField(value: string | undefined | null): string | undefined {
  if (!value || value.trim() === "") return undefined; // Optional field — blank is allowed
  if (value.trim().length !== 15) return "GSTIN must be exactly 15 characters";
  if (!isValidGstin(value)) return "Invalid GSTIN format (e.g. 22AAAAA0000A1Z5)";
  return undefined;
}

/**
 * Indian state codes mapped to state names, for display purposes.
 */
export const INDIAN_STATE_CODES: Record<string, string> = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra & Nagar Haveli and Daman & Diu",
  "27": "Maharashtra",
  "28": "Andhra Pradesh (before bifurcation)",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman & Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
  "97": "Other Territory",
  "99": "Centre Jurisdiction",
};

/**
 * Returns the state name for a given GSTIN, or null if invalid.
 */
export function getStateFromGstin(gstin: string): string | null {
  const code = getStateCodeFromGstin(gstin);
  if (!code) return null;
  return INDIAN_STATE_CODES[code] || null;
}
