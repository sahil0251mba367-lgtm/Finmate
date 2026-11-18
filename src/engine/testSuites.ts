import { kolkataMidnightUtcMs } from './formatters';
import { calculateSafeToSpend, computeCycleWindow } from './safeToSpend';
import { isDuplicateTransaction, parseBankSms } from './smsParser';
import { SpendCategory, TransactionDirection, TransactionRecord, UserSettings } from './types';

export interface SmsTestCase {
  id: string;
  bank: string;
  sender: string;
  body: string;
  synthetic: boolean;
  expectedOutcome: 'ignored' | 'parsed' | 'needsReview';
  expectedAmountPaise?: number;
  expectedDirection?: TransactionDirection;
  expectedCategory?: SpendCategory;
  note: string;
}

/**
 * 34 realistic Indian bank/UPI SMS samples across 8 banks (synthetic samples explicitly marked).
 */
export const SMS_PARSER_TEST_SUITE: SmsTestCase[] = [
  {
    id: 'SMS-01',
    bank: 'HDFC Bank',
    sender: 'AD-HDFCBK',
    body: 'Amt Sent Rs.180.00 From HDFC Bank A/C *4821 To Swiggy On 18-11 Ref 432319847120. Not You? Call 18002586161',
    synthetic: true,
    expectedOutcome: 'parsed',
    expectedAmountPaise: 18000,
    expectedDirection: 'DEBIT',
    expectedCategory: 'Food',
    note: 'HDFC UPI food debit with Ref',
  },
  {
    id: 'SMS-02',
    bank: 'SBI',
    sender: 'AX-SBIINB',
    body: 'Dear UPI user A/C X9012 debited by 45.00 on date 18Nov26 trf to CHAI POINT Refno 632189451023. If not u? call 1800111109.',
    synthetic: true,
    expectedOutcome: 'parsed',
    expectedAmountPaise: 4500,
    expectedDirection: 'DEBIT',
    expectedCategory: 'Food',
    note: 'SBI UPI debit without Rs prefix',
  },
  {
    id: 'SMS-03',
    bank: 'ICICI Bank',
    sender: 'VM-ICICIB',
    body: 'ICICI Bank Acct XX7712 debited for Rs 149.00 on 18-Nov-26; UBER INDIA SYSTEMS credited. UPI:632310293847.',
    synthetic: true,
    expectedOutcome: 'parsed',
    expectedAmountPaise: 14900,
    expectedDirection: 'DEBIT',
    expectedCategory: 'Travel',
    note: 'ICICI UPI travel debit',
  },
  {
    id: 'SMS-04',
    bank: 'Axis Bank',
    sender: 'JD-AXISBK',
    body: 'INR 320.00 debited from A/c no. XX3310 on 18-11-26 at Zomato Online. UPI Ref 632391827364.',
    synthetic: true,
    expectedOutcome: 'parsed',
    expectedAmountPaise: 32000,
    expectedDirection: 'DEBIT',
    expectedCategory: 'Food',
    note: 'Axis Bank INR debit',
  },
  {
    id: 'SMS-05',
    bank: 'Kotak Bank',
    sender: 'JK-KOTAKB',
    body: 'Sent Rs.65.00 from Kotak Bank AC X1145 to rapido@okicici on 18-11-26.UPI Ref 632344556677.',
    synthetic: true,
    expectedOutcome: 'parsed',
    expectedAmountPaise: 6500,
    expectedDirection: 'DEBIT',
    expectedCategory: 'Travel',
    note: 'Kotak VPA travel debit',
  },
  {
    id: 'SMS-06',
    bank: 'PNB',
    sender: 'AD-PNBSMS',
    body: 'Your A/c XX5501 is debited with INR 1,299.00 on 18-11-2026 via UPI to Amazon Pay India Ref 632311223344.',
    synthetic: true,
    expectedOutcome: 'parsed',
    expectedAmountPaise: 129900,
    expectedDirection: 'DEBIT',
    expectedCategory: 'Shopping',
    note: 'PNB comma-grouped shopping debit',
  },
  {
    id: 'SMS-07',
    bank: 'Bank of Baroda',
    sender: 'BX-BOBTXN',
    body: 'Rs.499.00 debited from A/c ...6209 on 18-11-26 at Udemy India. Info: UPI/632399887766.',
    synthetic: true,
    expectedOutcome: 'parsed',
    expectedAmountPaise: 49900,
    expectedDirection: 'DEBIT',
    expectedCategory: 'Academics',
    note: 'BOB academics course purchase',
  },
  {
    id: 'SMS-08',
    bank: 'Paytm Payments',
    sender: 'AD-PAYTMB',
    body: 'Paid Rs.55.00 to Metro Rail DMRC using Paytm UPI. Ref 632300112233.',
    synthetic: true,
    expectedOutcome: 'parsed',
    expectedAmountPaise: 5500,
    expectedDirection: 'DEBIT',
    expectedCategory: 'Travel',
    note: 'Paytm Metro travel debit',
  },
  {
    id: 'SMS-09',
    bank: 'HDFC Bank',
    sender: 'AD-HDFCBK',
    body: 'Rs.2500.00 credited to HDFC Bank A/C *4821 on 18-11-26 from RAHUL SHARMA via UPI Ref 632377665544.',
    synthetic: true,
    expectedOutcome: 'parsed',
    expectedAmountPaise: 250000,
    expectedDirection: 'CREDIT',
    expectedCategory: 'Others',
    note: 'Peer reimbursement credit (not spend)',
  },
  {
    id: 'SMS-10',
    bank: 'ICICI Bank',
    sender: 'VM-ICICIB',
    body: 'Refund of Rs 240.00 credited to ICICI Acct XX7712 from Swiggy on 18-Nov-26 Ref 632388990011.',
    synthetic: true,
    expectedOutcome: 'parsed',
    expectedAmountPaise: 24000,
    expectedDirection: 'REFUND',
    expectedCategory: 'Food',
    note: 'Swiggy refund reduces monthly spend',
  },
  {
    id: 'SMS-11',
    bank: 'SBI',
    sender: 'AX-SBIINB',
    body: 'Your Debit Card XX9012 spent Rs.799.00 at Flipkart on 18Nov26. Avl Bal Rs.4,120.50.',
    synthetic: true,
    expectedOutcome: 'parsed',
    expectedAmountPaise: 79900,
    expectedDirection: 'DEBIT',
    expectedCategory: 'Shopping',
    note: 'SBI Debit card POS/Ecom purchase',
  },
  {
    id: 'SMS-12',
    bank: 'HDFC Bank',
    sender: 'AD-HDFCBK',
    body: 'Rs.1000.00 withdrawn at SBI ATM Koramangala from HDFC Bank Card *4821 on 18-11-26.',
    synthetic: true,
    expectedOutcome: 'parsed',
    expectedAmountPaise: 100000,
    expectedDirection: 'DEBIT',
    expectedCategory: 'Others',
    note: 'ATM cash withdrawal',
  },
  {
    id: 'SMS-13',
    bank: 'Axis Bank',
    sender: 'JD-AXISBK',
    body: 'Spent INR 120.00 on Axis Debit Card XX3310 at Campus Stationery on 18-11-26.',
    synthetic: true,
    expectedOutcome: 'parsed',
    expectedAmountPaise: 12000,
    expectedDirection: 'DEBIT',
    expectedCategory: 'Academics',
    note: 'Campus stationery academics spend',
  },
  {
    id: 'SMS-14',
    bank: 'Kotak Bank',
    sender: 'JK-KOTAKB',
    body: 'INR 85.00 debited from Kotak AC X1145 to hostelcanteen@ybl Ref 632312121212.',
    synthetic: true,
    expectedOutcome: 'parsed',
    expectedAmountPaise: 8500,
    expectedDirection: 'DEBIT',
    expectedCategory: 'Food',
    note: 'Hostel canteen UPI spend',
  },
  {
    id: 'SMS-15',
    bank: 'HDFC Bank',
    sender: 'AD-HDFCBK',
    body: '481920 is your OTP for txn of Rs.1500.00 on HDFC Bank Card *4821. Do not share OTP.',
    synthetic: true,
    expectedOutcome: 'ignored',
    note: 'OTP message must be ignored completely',
  },
  {
    id: 'SMS-16',
    bank: 'ICICI Bank',
    sender: 'VM-ICICIB',
    body: 'Pre-approved Personal Loan offer up to Rs 2,00,000! Apply now with zero paperwork.',
    synthetic: true,
    expectedOutcome: 'ignored',
    note: 'Loan promotional message ignored',
  },
  {
    id: 'SMS-17',
    bank: 'Axis Bank',
    sender: 'JD-AXISBK',
    body: 'Exclusive cashback offer! Get 10% EMI offer on Flipkart with your Axis Card.',
    synthetic: true,
    expectedOutcome: 'ignored',
    note: 'Cashback/EMI offer ignored',
  },
  {
    id: 'SMS-18',
    bank: 'SBI',
    sender: 'AX-SBIINB',
    body: 'Your Credit Card bill of Rs.4,500.00 is due on 25-Nov-26. Minimum due Rs.250.00.',
    synthetic: true,
    expectedOutcome: 'ignored',
    note: 'Credit card bill reminder ignored',
  },
  {
    id: 'SMS-19',
    bank: 'Personal SMS',
    sender: '+919876543210',
    body: 'Bhai send Rs.500 for dinner split asap',
    synthetic: true,
    expectedOutcome: 'ignored',
    note: 'Non-bank sender ignored',
  },
  {
    id: 'SMS-20',
    bank: 'PNB',
    sender: 'AD-PNBSMS',
    body: 'Rs.350.00 paid to IRCTC Rail Connect from A/c XX5501. UPI Ref 632356565656.',
    synthetic: true,
    expectedOutcome: 'parsed',
    expectedAmountPaise: 35000,
    expectedDirection: 'DEBIT',
    expectedCategory: 'Travel',
    note: 'IRCTC train ticket booking',
  },
  {
    id: 'SMS-21',
    bank: 'HDFC Bank',
    sender: 'AD-HDFCBK',
    body: 'Amt Sent ₹99.50 From HDFC Bank A/C *4821 To Blinkit On 18-11 Ref 632378787878.',
    synthetic: true,
    expectedOutcome: 'parsed',
    expectedAmountPaise: 9950,
    expectedDirection: 'DEBIT',
    expectedCategory: 'Food',
    note: 'Rupee symbol ₹ with fractional paise',
  },
  {
    id: 'SMS-22',
    bank: 'ICICI Bank',
    sender: 'VM-ICICIB',
    body: 'ICICI Acct XX7712 debited Rs 899.00 on 18-Nov-26 to Myntra Designs. UPI:632314141414.',
    synthetic: true,
    expectedOutcome: 'parsed',
    expectedAmountPaise: 89900,
    expectedDirection: 'DEBIT',
    expectedCategory: 'Shopping',
    note: 'Myntra shopping spend',
  },
  {
    id: 'SMS-23',
    bank: 'Bank of Baroda',
    sender: 'BX-BOBTXN',
    body: 'INR 1500.00 paid to Delhi University Exam Fees via UPI Ref 632325252525.',
    synthetic: true,
    expectedOutcome: 'parsed',
    expectedAmountPaise: 150000,
    expectedDirection: 'DEBIT',
    expectedCategory: 'Academics',
    note: 'University exam fee',
  },
  {
    id: 'SMS-24',
    bank: 'SBI',
    sender: 'AX-SBIINB',
    body: 'Rs.75.00 debited from A/c X9012 to Zepto Grocery Ref 632336363636.',
    synthetic: true,
    expectedOutcome: 'parsed',
    expectedAmountPaise: 7500,
    expectedDirection: 'DEBIT',
    expectedCategory: 'Food',
    note: 'Zepto grocery food spend',
  },
  {
    id: 'SMS-25',
    bank: 'Axis Bank',
    sender: 'JD-AXISBK',
    body: 'Your A/c XX3310 has been credited with INR 12,000.00 on 01-11-26. Info: Monthly Allowance.',
    synthetic: true,
    expectedOutcome: 'parsed',
    expectedAmountPaise: 1200000,
    expectedDirection: 'CREDIT',
    expectedCategory: 'Others',
    note: 'Monthly allowance credit with comma formatting',
  },
  {
    id: 'SMS-26',
    bank: 'Kotak Bank',
    sender: 'JK-KOTAKB',
    body: 'Rs.199.00 reversed to Kotak AC X1145 from Zomato Ref 632347474747.',
    synthetic: true,
    expectedOutcome: 'parsed',
    expectedAmountPaise: 19900,
    expectedDirection: 'REFUND',
    expectedCategory: 'Food',
    note: 'Zomato reversal classified as REFUND',
  },
  {
    id: 'SMS-27',
    bank: 'HDFC Bank',
    sender: 'AD-HDFCBK',
    body: 'Alert: Transaction on HDFC A/C *4821 at Ola Cabs Ref 632358585858. Check statement.',
    synthetic: true,
    expectedOutcome: 'needsReview',
    note: 'Missing amount & direction -> Check these queue',
  },
  {
    id: 'SMS-28',
    bank: 'PNB',
    sender: 'AD-PNBSMS',
    body: 'Rs.40.00 processed on A/c XX5501 at Xerox Centre. Check balance.',
    synthetic: true,
    expectedOutcome: 'needsReview',
    note: 'Ambiguous direction ("processed") -> Check these queue',
  },
  {
    id: 'SMS-29',
    bank: 'Paytm Payments',
    sender: 'AD-PAYTMB',
    body: 'Paid Rs.210.00 to Domino Pizza via Paytm UPI. Ref 632369696969.',
    synthetic: true,
    expectedOutcome: 'parsed',
    expectedAmountPaise: 21000,
    expectedDirection: 'DEBIT',
    expectedCategory: 'Food',
    note: 'Domino Pizza food debit',
  },
  {
    id: 'SMS-30',
    bank: 'ICICI Bank',
    sender: 'VM-ICICIB',
    body: 'ICICI Acct XX7712 debited Rs 649.00 on 18-Nov-26 to Crossword Book Store Ref 632380808080.',
    synthetic: true,
    expectedOutcome: 'parsed',
    expectedAmountPaise: 64900,
    expectedDirection: 'DEBIT',
    expectedCategory: 'Academics',
    note: 'Crossword bookstore academics',
  },
  {
    id: 'SMS-31',
    bank: 'IndusInd Bank',
    sender: 'VD-INDUSB',
    body: 'Your IndusInd A/c XX2048 is debited for INR 110.00 at Starbucks Coffee via UPI Ref 632391919191.',
    synthetic: true,
    expectedOutcome: 'parsed',
    expectedAmountPaise: 11000,
    expectedDirection: 'DEBIT',
    expectedCategory: 'Food',
    note: 'IndusInd Bank UPI coffee spend',
  },
  {
    id: 'SMS-32',
    bank: 'HDFC Bank',
    sender: 'AD-HDFCBK',
    body: 'Amt Sent Rs.425.00 From HDFC Bank A/C *4821 To Decathlon Sports Ref 632302020202.',
    synthetic: true,
    expectedOutcome: 'parsed',
    expectedAmountPaise: 42500,
    expectedDirection: 'DEBIT',
    expectedCategory: 'Shopping',
    note: 'Decathlon shopping spend',
  },
  {
    id: 'SMS-33',
    bank: 'SBI',
    sender: 'AX-SBIINB',
    body: 'Your One Time Password is 991284 for Rs.800.00 purchase at Amazon.',
    synthetic: true,
    expectedOutcome: 'ignored',
    note: 'Full words One Time Password ignored',
  },
  {
    id: 'SMS-34',
    bank: 'Axis Bank',
    sender: 'JD-AXISBK',
    body: 'INR 135.00 paid to BMTC Bus Pass via UPI Ref 632315151515.',
    synthetic: true,
    expectedOutcome: 'parsed',
    expectedAmountPaise: 13500,
    expectedDirection: 'DEBIT',
    expectedCategory: 'Travel',
    note: 'BMTC bus travel debit',
  },
];

export interface TestCaseResult {
  id: string;
  bank: string;
  note: string;
  passed: boolean;
  categoryCorrect: boolean;
  details: string;
}

export interface SuiteExecutionReport {
  total: number;
  passed: number;
  categoryAccuracyPct: number;
  dedupPassed: boolean;
  budgetTestsPassed: number;
  budgetTestsTotal: number;
  results: TestCaseResult[];
  budgetResults: { name: string; passed: boolean; detail: string }[];
}

export function runAllDomainTests(): SuiteExecutionReport {
  const now = Date.now();
  let passedCount = 0;
  let catEvaluated = 0;
  let catCorrect = 0;

  const results: TestCaseResult[] = SMS_PARSER_TEST_SUITE.map((tc) => {
    const out = parseBankSms({ sender: tc.sender, body: tc.body, receivedAtMs: now });

    let ok = false;
    let catOk = true;
    let details = '';

    if (tc.expectedOutcome === 'ignored') {
      ok = out.status === 'ignored';
      details = ok ? 'Ignored as expected' : `Expected ignored, got ${out.status}`;
    } else if (tc.expectedOutcome === 'needsReview') {
      ok = out.status === 'parsed' && out.transaction.needsReview;
      details = ok ? 'Flagged for Check these review' : 'Expected needsReview=true';
    } else {
      if (out.status === 'parsed' && !out.transaction.needsReview) {
        const amtMatch = out.transaction.amountPaise === tc.expectedAmountPaise;
        const dirMatch = out.transaction.direction === tc.expectedDirection;
        catEvaluated += 1;
        catOk = out.transaction.category === tc.expectedCategory;
        if (catOk) catCorrect += 1;
        ok = amtMatch && dirMatch && catOk;
        details = `${out.transaction.direction} ₹${(out.transaction.amountPaise / 100).toFixed(0)} · ${out.transaction.merchant} · ${out.transaction.category}`;
      } else {
        details = 'Failed to parse expected transaction';
      }
    }

    if (ok) passedCount += 1;
    return {
      id: tc.id,
      bank: tc.bank,
      note: tc.note,
      passed: ok,
      categoryCorrect: catOk,
      details,
    };
  });

  // Deduplication verification (UPI Ref match + 2-min fallback)
  const existingTx: TransactionRecord = {
    id: 'existing-1',
    amountPaise: 18000,
    direction: 'DEBIT',
    mode: 'UPI',
    merchant: 'Swiggy',
    merchantKey: 'swiggy',
    category: 'Food',
    categorySource: 'auto',
    timestamp: now,
    upiRef: '432319847120',
    needsReview: false,
    source: 'sms',
  };
  const dupByRef = isDuplicateTransaction(
    { amountPaise: 18000, merchantKey: 'swiggy instamart', timestamp: now + 60_000, upiRef: '432319847120' },
    [existingTx]
  );
  const dupByWindow = isDuplicateTransaction(
    { amountPaise: 18000, merchantKey: 'swiggy', timestamp: now + 90_000 },
    [existingTx]
  );
  const nonDupAfterWindow = !isDuplicateTransaction(
    { amountPaise: 18000, merchantKey: 'swiggy', timestamp: now + 180_000 },
    [existingTx]
  );
  const dedupPassed = dupByRef && dupByWindow && nonDupAfterWindow;

  // Safe-to-Spend unit tests
  const baseSettings: UserSettings = {
    allowancePaise: 1200000, // ₹12,000
    allowanceDay: 31,
    fixedCommitmentsPaise: 300000, // ₹3,000
    onboardingCompleted: true,
    smsPermissionState: 'granted',
    onboardingVariant: 'A',
  };

  // 1. Leap year Feb 29 clamping (2024-02-29)
  const feb28_2024 = kolkataMidnightUtcMs(2024, 2, 28) + 12 * 3600 * 1000;
  const leapCycle = computeCycleWindow(31, feb28_2024);
  const leapOk = leapCycle.daysLeftInCycle === 1; // Next cycle starts Feb 29 (clamped from 31)

  // 2. Non-leap year Feb 28 clamping (2026-02-27 -> next start Feb 28)
  const feb27_2026 = kolkataMidnightUtcMs(2026, 2, 27) + 12 * 3600 * 1000;
  const nonLeapCycle = computeCycleWindow(31, feb27_2026);
  const nonLeapOk = nonLeapCycle.daysLeftInCycle === 1;

  // 3. Zero-spend cycle math
  const startOfCycle = kolkataMidnightUtcMs(2026, 11, 1) + 10 * 3600 * 1000;
  const zeroSpendSnapshot = calculateSafeToSpend(
    { ...baseSettings, allowanceDay: 1 },
    [],
    null,
    startOfCycle
  );
  // 12,000 - 3,000 = 9,000 over 30 days = ₹300/day (30000 paise)
  const zeroSpendOk = zeroSpendSnapshot.dailyLimitPaise === 30000;

  // 4. Month boundary + refund reduces spend
  const txDebit: TransactionRecord = {
    id: 'b1',
    amountPaise: 50000,
    direction: 'DEBIT',
    mode: 'UPI',
    merchant: 'Swiggy',
    merchantKey: 'swiggy',
    category: 'Food',
    categorySource: 'auto',
    timestamp: startOfCycle,
    needsReview: false,
    source: 'sms',
  };
  const txRefund: TransactionRecord = {
    id: 'b2',
    amountPaise: 20000,
    direction: 'REFUND',
    mode: 'UPI',
    merchant: 'Swiggy',
    merchantKey: 'swiggy',
    category: 'Food',
    categorySource: 'auto',
    timestamp: startOfCycle + 60_000,
    needsReview: false,
    source: 'sms',
  };
  const refundSnapshot = calculateSafeToSpend(
    { ...baseSettings, allowanceDay: 1 },
    [txDebit, txRefund],
    null,
    startOfCycle + 120_000
  );
  const refundOk = refundSnapshot.spentThisCyclePaise === 30000;

  const budgetResults = [
    {
      name: 'Leap year Feb 29 allowanceDay=31 clamping',
      passed: leapOk,
      detail: `daysLeftInCycle=${leapCycle.daysLeftInCycle} (expected 1)`,
    },
    {
      name: 'Non-leap year Feb 28 allowanceDay=31 clamping',
      passed: nonLeapOk,
      detail: `daysLeftInCycle=${nonLeapCycle.daysLeftInCycle} (expected 1)`,
    },
    {
      name: 'Zero-spend 30-day cycle daily limit',
      passed: zeroSpendOk,
      detail: `dailyLimitPaise=${zeroSpendSnapshot.dailyLimitPaise} (₹300/day)`,
    },
    {
      name: 'Refund reduces monthly spend accurately',
      passed: refundOk,
      detail: `netSpent=${refundSnapshot.spentThisCyclePaise} paise (₹300)`,
    },
  ];

  return {
    total: SMS_PARSER_TEST_SUITE.length,
    passed: passedCount,
    categoryAccuracyPct: catEvaluated > 0 ? Math.round((catCorrect / catEvaluated) * 100) : 100,
    dedupPassed,
    budgetTestsPassed: budgetResults.filter((b) => b.passed).length,
    budgetTestsTotal: budgetResults.length,
    results,
    budgetResults,
  };
}
