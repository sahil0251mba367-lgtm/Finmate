import { getKolkataDateParts, kolkataMidnightUtcMs } from './formatters';
import { SavingsGoal, TransactionRecord, UserSettings } from './types';

export interface CycleWindow {
  cycleStartMs: number;
  cycleEndExclusiveMs: number;
  daysLeftInCycle: number; // includes today, always >= 1
  todayStartMs: number;
  todayEndExclusiveMs: number;
  cycleLabel: string;
}

export interface SafeToSpendSnapshot {
  dailyLimitPaise: number;
  todayRemainingPaise: number;
  spentThisCyclePaise: number;
  refundsThisCyclePaise: number;
  otherIncomeThisCyclePaise: number;
  spentTodayPaise: number;
  remainingAllowancePaise: number;
  savingsPlannedThisCyclePaise: number;
  cycle: CycleWindow;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function clampedDate(year: number, month: number, targetDay: number): {
  year: number;
  month: number;
  day: number;
} {
  const clamped = Math.min(Math.max(1, targetDay), daysInMonth(year, month));
  return { year, month, day: clamped };
}

function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const totalMonths = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = (totalMonths % 12) + 1;
  return { year: nextYear, month: nextMonth };
}

/**
 * Computes the active allowance cycle in Asia/Kolkata timezone.
 * Cycle runs from the allowance day to the day before the next allowance day.
 * Clamps 29th–31st allowance dates safely for shorter months and leap years.
 */
export function computeCycleWindow(allowanceDay: number, nowMs: number = Date.now()): CycleWindow {
  const today = getKolkataDateParts(nowMs);
  const clampedCurrent = clampedDate(today.year, today.month, allowanceDay);

  let startParts: { year: number; month: number; day: number };
  let nextStartParts: { year: number; month: number; day: number };

  if (today.day >= clampedCurrent.day) {
    startParts = clampedCurrent;
    const nextYm = addMonths(today.year, today.month, 1);
    nextStartParts = clampedDate(nextYm.year, nextYm.month, allowanceDay);
  } else {
    const prevYm = addMonths(today.year, today.month, -1);
    startParts = clampedDate(prevYm.year, prevYm.month, allowanceDay);
    nextStartParts = clampedCurrent;
  }

  const cycleStartMs = kolkataMidnightUtcMs(startParts.year, startParts.month, startParts.day);
  const cycleEndExclusiveMs = kolkataMidnightUtcMs(
    nextStartParts.year,
    nextStartParts.month,
    nextStartParts.day
  );
  const todayStartMs = kolkataMidnightUtcMs(today.year, today.month, today.day);
  const nextDayUtc = Date.UTC(today.year, today.month - 1, today.day + 1, 0, 0, 0, 0) - 5.5 * 3600 * 1000;

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const rawDaysLeft = Math.round((cycleEndExclusiveMs - todayStartMs) / MS_PER_DAY);
  const daysLeftInCycle = Math.max(1, rawDaysLeft);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const endDateDisplay = new Date(cycleEndExclusiveMs - MS_PER_DAY + 5.5 * 3600 * 1000);
  const endDay = endDateDisplay.getUTCDate();
  const endMonth = monthNames[endDateDisplay.getUTCMonth()];
  const startMonth = monthNames[startParts.month - 1];

  return {
    cycleStartMs,
    cycleEndExclusiveMs,
    daysLeftInCycle,
    todayStartMs,
    todayEndExclusiveMs: nextDayUtc,
    cycleLabel: `${startParts.day} ${startMonth} – ${endDay} ${endMonth}`,
  };
}

export function computeSavingsPlannedPaise(
  goal: SavingsGoal | null,
  nowMs: number = Date.now()
): number {
  if (!goal) return 0;
  const remainingTarget = Math.max(0, goal.targetPaise - goal.savedPaise);
  if (remainingTarget === 0) return 0;

  const [y, m, d] = goal.targetDateIso.split('-').map(Number);
  if (!y || !m || !d) return 0;
  const targetMs = kolkataMidnightUtcMs(y, m, d);
  const today = getKolkataDateParts(nowMs);
  const todayMs = kolkataMidnightUtcMs(today.year, today.month, today.day);
  const daysToTarget = Math.max(1, Math.ceil((targetMs - todayMs) / (24 * 60 * 60 * 1000)));
  const monthsRemaining = Math.max(1, Math.ceil(daysToTarget / 30));

  return Math.floor(remainingTarget / monthsRemaining);
}

/**
 * Safe-to-Spend Formula:
 * dailyLimit = max(0, (monthlyAllowance + otherIncomeThisCycle - netSpentThisCycle - fixedCommitmentsRemaining - savingsContributionsPlanned) / daysLeftInCycle)
 * Refunds reduce spend for that month; credits are recorded as other income without inflating spend.
 */
export function calculateSafeToSpend(
  settings: UserSettings,
  transactions: readonly TransactionRecord[],
  goal: SavingsGoal | null,
  nowMs: number = Date.now()
): SafeToSpendSnapshot {
  const cycle = computeCycleWindow(settings.allowanceDay, nowMs);

  let grossDebitCycle = 0;
  let refundsCycle = 0;
  let otherIncomeCycle = 0;
  let netSpentToday = 0;

  for (const tx of transactions) {
    if (tx.needsReview) continue;
    if (tx.timestamp < cycle.cycleStartMs || tx.timestamp >= cycle.cycleEndExclusiveMs) {
      continue;
    }

    const isToday = tx.timestamp >= cycle.todayStartMs && tx.timestamp < cycle.todayEndExclusiveMs;

    if (tx.direction === 'DEBIT') {
      grossDebitCycle += tx.amountPaise;
      if (isToday) netSpentToday += tx.amountPaise;
    } else if (tx.direction === 'REFUND') {
      refundsCycle += tx.amountPaise;
      if (isToday) netSpentToday -= tx.amountPaise;
    } else if (tx.direction === 'CREDIT') {
      otherIncomeCycle += tx.amountPaise;
    }
  }

  const netSpentThisCycle = Math.max(0, grossDebitCycle - refundsCycle);
  const savingsPlanned = computeSavingsPlannedPaise(goal, nowMs);

  const poolPaise =
    settings.allowancePaise +
    otherIncomeCycle -
    netSpentThisCycle -
    settings.fixedCommitmentsPaise -
    savingsPlanned;

  const dailyLimitPaise = Math.max(0, Math.floor(poolPaise / cycle.daysLeftInCycle));
  const todayRemainingPaise = dailyLimitPaise - Math.max(0, netSpentToday);

  return {
    dailyLimitPaise,
    todayRemainingPaise,
    spentThisCyclePaise: netSpentThisCycle,
    refundsThisCyclePaise: refundsCycle,
    otherIncomeThisCyclePaise: otherIncomeCycle,
    spentTodayPaise: Math.max(0, netSpentToday),
    remainingAllowancePaise: Math.max(0, poolPaise),
    savingsPlannedThisCyclePaise: savingsPlanned,
    cycle,
  };
}
