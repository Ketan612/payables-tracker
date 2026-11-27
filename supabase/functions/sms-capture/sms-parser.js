const months = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};

export function parseSms(raw) {
  const text = String(raw || "").replace(/\s+/g, " ").trim();
  const amountPatterns = [
    /(?:debited|credited)\s+(?:by|with|for)?\s*(?:INR|Rs\.?|₹)?\s*([0-9,]+(?:\.\d{1,2})?)/i,
    /(?:INR|Rs\.?|₹)\s*([0-9,]+(?:\.\d{1,2})?)/i,
    /\b([0-9,]+(?:\.\d{1,2})?)\s*(?:INR|rupees?)\b/i
  ];
  let rawAmount = null;
  for (const pattern of amountPatterns) {
    const match = text.match(pattern);
    if (match) { rawAmount = match[1]; break; }
  }
  const amount = rawAmount ? Number(rawAmount.replace(/,/g, "")) : null;

  // Prefer the action explicitly attached to the account holder's account.
  // Counterparty wording (e.g. "CHETAN RAVINDRA credited") must not reverse
  // an account debit into a credit or make the direction ambiguous.
  const accountAction = text.match(/\b(?:a\/?c|account|acct)\b(?:\s*(?:no\.?|number))?(?:\s*[:#-]?\s*[x*•-]*\d{2,})?(?:\s+(?:has\s+been|is))?\s+(debited|credited)\b/i);
  const debit = /\b(debited|debit|spent|paid|purchase|withdrawn|sent|trf to|transferred to)\b/i.test(text);
  const credit = /\b(credited|credit|received|refund|cashback|deposited)\b/i.test(text);
  const direction = accountAction
    ? (accountAction[1].toLowerCase() === "debited" ? "out" : "in")
    : debit && !credit ? "out" : credit && !debit ? "in" : null;

  const acct = text.match(/(?:A\/?C|account|acct)\s*(?:no\.?|number)?\s*[:#-]?\s*([Xx*•-]*\d{2,})/i);
  const accountIdentifier = acct ? (acct[1].match(/\d+/g) || []).join("") || null : null;

  // ICICI and other banks commonly label the UPI transaction reference as "UPI:...".
  const ref = text.match(/\b(?:ref(?:erence)?\s*(?:no\.?|number)?|refno|utr|upi)\s*[:#-]?\s*(\d{6,})\b/i);
  const referenceNumber = ref?.[1] || null;

  let date = null;
  const namedDate = text.match(/\b(\d{1,2})[\s/-]*([A-Za-z]{3})[\s,-]*(\d{2,4})\b/);
  const numericDate = text.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/);
  if (namedDate) {
    const d = +namedDate[1], m = months[namedDate[2].toLowerCase()];
    let y = +namedDate[3]; if (y < 100) y += 2000;
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (m && dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d) date = dt.toISOString().slice(0, 10);
  } else if (numericDate) {
    const parts = numericDate[1].split(/[/-]/).map(Number);
    let d, m, y;
    if (parts[0] > 12) { d = parts[0]; m = parts[1]; y = parts[2]; }
    else { m = parts[0]; d = parts[1]; y = parts[2]; }
    if (y < 100) y += 2000;
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d) date = dt.toISOString().slice(0, 10);
  }

  // For account debits, banks may phrase the beneficiary as "NAME credited".
  const counterparty = text.match(/;\s*([A-Z0-9][A-Z0-9 .&'_-]{1,44}?)\s+(?:credited|debited)\b/i);
  const merchant = text.match(/\b(?:trf\s+to|transfer(?:red)?\s+to|sent\s+to|towards|at|merchant)\s+([A-Z0-9 ._'&-]{2,45}?)(?=\s+(?:Ref(?:no|erence)?|UPI|on\s+date|dated|for\s+|\b[A/C]|\bif\s+not)|[.;]|$)/i);
  const description = counterparty
    ? counterparty[1].trim().replace(/[. ]+$/, "")
    : merchant ? merchant[1].trim().replace(/[. ]+$/, "") : text.slice(0, 120);

  return {
    amount,
    direction,
    date,
    description,
    account_identifier: accountIdentifier,
    reference_number: referenceNumber,
    reason: !amount || amount <= 0
      ? "Amount not confidently parsed"
      : !direction
        ? "Could not determine debit/credit"
        : !date
          ? "Transaction date not found; manual review required"
          : null
  };
}


// Merchant labels are kept separate from the bank-provided transaction description.
export const DEFAULT_PARTICULARS = Object.freeze(["Groceries","Dairy Products","Vegetables","Medical Supplies","Household Items","Food & Dining","Fuel","Personal Transfer"]);

export function normalizeMerchantKey(value) {
  return String(value || "").normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

export function isMerchantCandidate(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length < 2 || text.length > 50) return false;
  return !/\b(?:debited|credited|account|a\/c|acct|upi|utr|reference|refno|transaction|inr|rupees?)\b/i.test(text);
}

export function buildParticularSuggestions(saved = [], limit = 8) {
  const labels = [];
  const seen = new Set();
  for (const item of [...(Array.isArray(saved) ? saved : []), ...DEFAULT_PARTICULARS]) {
    const label = String(typeof item === "string" ? item : item?.particulars || "").replace(/\s+/g, " ").trim().slice(0, 80);
    const key = label.toLowerCase();
    if (!label || key === "other" || key === "skip for now" || seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
    if (labels.length >= limit) break;
  }
  return [...labels, "Other", "Skip for now"];
}
