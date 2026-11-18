import {
  CategorySource,
  PaymentMode,
  SpendCategory,
  TransactionDirection,
  TransactionRecord,
} from './types';

/**
 * Extensible allow-list of Indian bank & UPI DLT sender IDs.
 * Matches headers like "XX-HDFCBK", "AD-SBIINB-S", "JM-AXISBK-T", or "HDFCBK".
 */
export const BANK_SENDER_ALLOW_LIST: readonly string[] = [
  'HDFCBK',
  'SBIINB',
  'SBIPSG',
  'SBIUPI',
  'ICICIB',
  'AXISBK',
  'KOTAKB',
  'PNBSMS',
  'BOBTXN',
  'PAYTMB',
  'INDUSB',
  'YESBNK',
  'CANBNK',
  'UNIONB',
  'FEDBNK',
  'IDFCFB',
  'PHONEP',
  'GPAYIN',
];

const IGNORE_KEYWORDS = [
  'otp',
  'one time password',
  'one-time password',
  'verification code',
  'offer',
  'cashback offer',
  'emi offer',
  'loan',
  'pre-approved',
  'credit card bill',
  'bill due',
  'minimum due',
  'win rs',
  'apply now',
  'reward points',
];

export interface RawSmsInput {
  sender: string;
  body: string;
  receivedAtMs: number;
}

export type SmsParseOutcome =
  | { status: 'ignored'; reason: string }
  | {
      status: 'parsed';
      transaction: Omit<TransactionRecord, 'id'>;
    };

export function normalizeSenderCode(rawSender: string): string {
  const upper = rawSender.trim().toUpperCase();
  // Handle DLT format like "AD-HDFCBK-S" or "XX-SBIINB"
  const dltMatch = upper.match(/^[A-Z0-9]{2}-([A-Z0-9]{4,10})(?:-[A-Z])?$/);
  if (dltMatch) {
    return dltMatch[1];
  }
  return upper.replace(/[^A-Z0-9]/g, '');
}

export function isAllowedBankSender(
  rawSender: string,
  allowList: readonly string[] = BANK_SENDER_ALLOW_LIST
): boolean {
  const code = normalizeSenderCode(rawSender);
  if (!code) return false;
  return allowList.some((allowed) => code === allowed || code.includes(allowed));
}

export function normalizeMerchantKey(merchant: string): string {
  return merchant
    .toLowerCase()
    .replace(/@[a-z0-9._-]+/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const FOOD_KEYWORDS = [
  'swiggy',
  'zomato',
  'cafe',
  'coffee',
  'chai',
  'tea',
  'canteen',
  'mess',
  'tiffin',
  'bakery',
  'biryani',
  'pizza',
  'domino',
  'mcdonald',
  'kfc',
  'burger',
  'starbucks',
  'chaayos',
  'blinkit',
  'zepto',
  'instamart',
  'bigbasket',
  'dhaba',
  'restaurant',
  'food',
  'eatery',
  'haldiram',
  'bikaner',
];

const TRAVEL_KEYWORDS = [
  'uber',
  'ola',
  'rapido',
  'irctc',
  'metro',
  'dmrc',
  'bmrc',
  'bmtc',
  'redbus',
  'abhibus',
  'rail',
  'petrol',
  'fuel',
  'hpcl',
  'bpcl',
  'iocl',
  'indian oil',
  'indigo',
  'makemytrip',
  'yulu',
  'namma yatri',
  'auto',
  'cab',
  'toll',
  'fastag',
];

const SHOPPING_KEYWORDS = [
  'amazon',
  'flipkart',
  'myntra',
  'ajio',
  'nykaa',
  'meesho',
  'croma',
  'reliance digital',
  'decathlon',
  'zudio',
  'westside',
  'h&m',
  'zara',
  'dmart',
  'retail',
  'mart',
  'mall',
];

const ACADEMICS_KEYWORDS = [
  'college',
  'university',
  'univ',
  'institute',
  'iit',
  'nit',
  'vit',
  'bits',
  'manipal',
  'du ',
  'fees',
  'tuition',
  'exam',
  'stationery',
  'xerox',
  'print',
  'udemy',
  'coursera',
  'nptel',
  'book',
  'crossword',
  'sapna',
  'library',
  'hostel',
  'semester',
];

export function categoriseMerchant(
  merchant: string,
  overrides: Record<string, SpendCategory> = {}
): { category: SpendCategory; source: CategorySource } {
  const key = normalizeMerchantKey(merchant);
  if (key && overrides[key]) {
    return { category: overrides[key], source: 'user' };
  }

  const lower = merchant.toLowerCase();
  if (FOOD_KEYWORDS.some((kw) => lower.includes(kw))) {
    return { category: 'Food', source: 'auto' };
  }
  if (TRAVEL_KEYWORDS.some((kw) => lower.includes(kw))) {
    return { category: 'Travel', source: 'auto' };
  }
  if (ACADEMICS_KEYWORDS.some((kw) => lower.includes(kw))) {
    return { category: 'Academics', source: 'auto' };
  }
  if (SHOPPING_KEYWORDS.some((kw) => lower.includes(kw))) {
    return { category: 'Shopping', source: 'auto' };
  }
  return { category: 'Others', source: 'auto' };
}

function extractAmountPaise(body: string): number | null {
  const numPattern = '([0-9]{1,3}(?:,[0-9]{2,3})+(?:\\.[0-9]{1,2})?|[0-9]+(?:\\.[0-9]{1,2})?)';
  const patterns = [
    new RegExp(`(?:rs\\.?|inr|₹)\\s*${numPattern}`, 'i'),
    new RegExp(`${numPattern}\\s*(?:inr|rs\\.?)`, 'i'),
    new RegExp(`debited\\s+by\\s+${numPattern}`, 'i'),
  ];

  for (const regex of patterns) {
    const match = body.match(regex);
    if (match && match[1]) {
      const cleaned = match[1].replace(/,/g, '');
      const parts = cleaned.split('.');
      const rupees = Number.parseInt(parts[0], 10);
      if (!Number.isFinite(rupees)) continue;
      const paisePart = parts[1] ? Number.parseInt(parts[1].padEnd(2, '0').slice(0, 2), 10) : 0;
      const total = rupees * 100 + paisePart;
      if (total > 0) return total;
    }
  }
  return null;
}

function extractDirection(body: string): TransactionDirection | null {
  const lower = body.toLowerCase();
  const isRefund = /\b(refund|refunded|reversed|reversal|cashback credited)\b/.test(lower);
  if (isRefund) return 'REFUND';

  // Account-holder debit phrasing that also mentions payee "credited" (e.g., ICICI alerts)
  if (/\b(?:acct|a\/c|account)\s+[x*0-9]+\s+debited\b/.test(lower)) {
    return 'DEBIT';
  }

  const debitScore = (
    lower.match(/\b(debited|spent|paid|sent|withdrawn|purchase|deducted|dr\b)\b/g) ?? []
  ).length;
  const creditScore = (
    lower.match(/\b(credited|received|deposited|cr\b)\b/g) ?? []
  ).length;

  if (debitScore > 0 && creditScore === 0) return 'DEBIT';
  if (creditScore > 0 && debitScore === 0) return 'CREDIT';
  if (debitScore > creditScore) return 'DEBIT';
  if (creditScore > debitScore) return 'CREDIT';
  return null;
}

function extractMode(body: string): PaymentMode {
  const lower = body.toLowerCase();
  if (/\b(atm|cash withdrawal|withdrawn at)\b/.test(lower)) return 'ATM';
  if (/\b(upi|vpa|gpay|phonepe|paytm|bhim)\b/.test(lower) || /@[a-z0-9]+/i.test(body)) {
    return 'UPI';
  }
  if (/\b(debit card|card|pos|ecom)\b/.test(lower)) return 'DEBIT_CARD';
  return 'OTHER';
}

function extractAccountLast4(body: string): string | undefined {
  const match = body.match(/(?:a\/c|acct|account|card)\s*(?:no\.?\s*)?(?:xx+|x+|\*+)?([0-9]{4})\b/i);
  if (match?.[1]) return match[1];
  const xMatch = body.match(/[xX*]{2,}([0-9]{4})\b/);
  return xMatch?.[1];
}

function extractUpiRef(body: string): string | undefined {
  const patterns = [
    /(?:upi\s*ref(?:\s*no\.?)?|ref(?:\s*no\.?)?|utr|rrn)\s*[:#-]?\s*([0-9]{9,14})/i,
    /\b([0-9]{12})\b/,
  ];
  for (const regex of patterns) {
    const match = body.match(regex);
    if (match?.[1]) return match[1];
  }
  return undefined;
}

function cleanMerchantCandidate(raw: string): string {
  return raw
    .replace(/\b(on|via|using|from|ref|upi|avl|bal|balance|not\s+you|if\s+not).*$/i, '')
    .replace(/[.();,]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMerchant(body: string, mode: PaymentMode): string {
  if (mode === 'ATM') {
    const atmMatch = body.match(/(?:at|from)\s+([A-Za-z0-9 &._/-]{3,40}?)(?:\s+on|\s+bal|\.|,|$)/i);
    if (atmMatch?.[1]) {
      return `ATM - ${cleanMerchantCandidate(atmMatch[1])}`;
    }
    return 'ATM Cash Withdrawal';
  }

  // ICICI "; MERCHANT credited." pattern
  const iciciMatch = body.match(/;\s*([A-Za-z0-9 .&'_-]{2,45}?)\s+credited\b/i);
  if (iciciMatch?.[1]) {
    const cleaned = cleanMerchantCandidate(iciciMatch[1]);
    if (cleaned.length >= 2) return cleaned;
  }

  // VPA pattern e.g. swiggy@axisbank
  const vpaMatch = body.match(/\b([a-zA-Z0-9._-]{2,}@[a-zA-Z0-9]{2,})\b/);

  // Explicit "to <merchant>" / "at <merchant>" / "info: UPI/<merchant>" / "from <sender>"
  const patterns = [
    /(?:to|towards|paid to|sent to|trf to)\s+([A-Za-z0-9@._&' -]{2,45}?)(?=\s+(?:from|on|via|ref|upi|avl|bal|if\s+not)|\.|,|;|$)/i,
    /\bat\s+([A-Za-z0-9._&' -]{2,45}?)(?=\s+(?:from|on|via|ref|upi|avl|bal|if\s+not)|\.|,|;|$)/i,
    /(?:info)\s*[:/-]?\s*(?:upi\/)?([A-Za-z0-9@._&' -]{2,40}?)(?=\/|\s+ref|\.|,|$)/i,
    /(?:from)\s+([A-Za-z0-9@._&' -]{2,40}?)(?=\s+(?:via|on|ref|upi|avl|bal)|\.|,|;|$)/i,
  ];

  for (const regex of patterns) {
    const match = body.match(regex);
    if (match?.[1]) {
      const cleaned = cleanMerchantCandidate(match[1]);
      if (
        cleaned.length >= 2 &&
        !/^(your|a\/c|acct|account|bank|xx\d+|\d+)$/i.test(cleaned) &&
        !/\b(?:a\/c|acct|ac|account)\b/i.test(cleaned)
      ) {
        return cleaned;
      }
    }
  }

  if (vpaMatch?.[1]) {
    const handle = vpaMatch[1].split('@')[0];
    return handle.replace(/[._-]+/g, ' ').trim();
  }

  return 'Unknown Merchant';
}

/**
 * Pure SMS parser mirroring FinMate's Kotlin SmsParser.
 * Never persists or logs raw SMS body; outputs only structured transaction fields.
 */
export function parseBankSms(
  input: RawSmsInput,
  overrides: Record<string, SpendCategory> = {},
  allowList: readonly string[] = BANK_SENDER_ALLOW_LIST
): SmsParseOutcome {
  if (!isAllowedBankSender(input.sender, allowList)) {
    return { status: 'ignored', reason: 'Sender not in bank/UPI allow-list' };
  }

  const lower = input.body.toLowerCase();
  if (IGNORE_KEYWORDS.some((kw) => lower.includes(kw))) {
    return { status: 'ignored', reason: 'OTP, promotional, or loan/credit-card alert' };
  }

  const amountPaise = extractAmountPaise(input.body);
  const direction = extractDirection(input.body);
  const mode = extractMode(input.body);
  const accountLast4 = extractAccountLast4(input.body);
  const upiRef = extractUpiRef(input.body);
  const merchant = extractMerchant(input.body, mode);
  const merchantKey = normalizeMerchantKey(merchant);
  const { category, source } = categoriseMerchant(merchant, overrides);

  const needsReview = amountPaise === null || direction === null;

  return {
    status: 'parsed',
    transaction: {
      amountPaise: amountPaise ?? 0,
      direction: direction ?? 'DEBIT',
      mode,
      merchant,
      merchantKey,
      category,
      categorySource: source,
      timestamp: input.receivedAtMs,
      upiRef,
      accountLast4,
      needsReview,
      source: 'sms',
    },
  };
}

/**
 * Deduplicates incoming SMS transaction against existing transactions:
 * 1. Exact UPI reference match (when present)
 * 2. Same amountPaise + same normalized merchantKey + within 2 minutes (120,000 ms)
 */
export function isDuplicateTransaction(
  candidate: Pick<TransactionRecord, 'amountPaise' | 'merchantKey' | 'timestamp' | 'upiRef'>,
  existing: readonly TransactionRecord[]
): boolean {
  const TWO_MINUTES_MS = 2 * 60 * 1000;

  return existing.some((tx) => {
    if (candidate.upiRef && tx.upiRef && candidate.upiRef === tx.upiRef) {
      return true;
    }
    const sameAmount = candidate.amountPaise > 0 && candidate.amountPaise === tx.amountPaise;
    const sameMerchant =
      candidate.merchantKey.length > 0 && candidate.merchantKey === tx.merchantKey;
    const withinWindow = Math.abs(candidate.timestamp - tx.timestamp) <= TWO_MINUTES_MS;
    return sameAmount && sameMerchant && withinWindow;
  });
}
