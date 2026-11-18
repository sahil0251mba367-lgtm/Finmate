import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Moon,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Sun,
} from 'lucide-react';
import { formatInr, formatKolkataDate } from '../engine/formatters';
import { SafeToSpendSnapshot } from '../engine/safeToSpend';
import {
  SavingsGoal,
  SpendCategory,
  TransactionDirection,
  TransactionRecord,
  UserSettings,
} from '../engine/types';
import { CATEGORY_COLORS, CategorySlice, DonutChart } from './DonutChart';

interface DashboardViewProps {
  settings: UserSettings;
  snapshot: SafeToSpendSnapshot;
  transactions: TransactionRecord[];
  goal: SavingsGoal | null;
  merchantOverrides: Record<string, SpendCategory>;
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenAddExpense: () => void;
  onOpenOnboarding: () => void;
  onOpenGoalTab: () => void;
  onOpenSmsLab: () => void;
  onChangeCategory: (txId: string, newCategory: SpendCategory) => void;
  onResolveReview: (txId: string, amountPaise: number, direction: TransactionDirection) => void;
  onGrantSmsLater: () => void;
  onSimulateIncomingSms: () => void;
}

const CATEGORIES: SpendCategory[] = ['Food', 'Travel', 'Shopping', 'Academics', 'Others'];

export const DashboardView: React.FC<DashboardViewProps> = ({
  settings,
  snapshot,
  transactions,
  goal,
  merchantOverrides,
  isDark,
  onToggleTheme,
  onOpenAddExpense,
  onOpenOnboarding,
  onOpenGoalTab,
  onOpenSmsLab,
  onChangeCategory,
  onResolveReview,
  onGrantSmsLater,
  onSimulateIncomingSms,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<SpendCategory | 'All'>('All');
  const [reviewAmounts, setReviewAmounts] = useState<Record<string, string>>({});
  const [reviewDirs, setReviewDirs] = useState<Record<string, TransactionDirection>>({});

  const needsReviewItems = useMemo(
    () => transactions.filter((t) => t.needsReview),
    [transactions]
  );

  const validTransactions = useMemo(
    () =>
      transactions
        .filter((t) => !t.needsReview)
        .sort((a, b) => b.timestamp - a.timestamp),
    [transactions]
  );

  const filteredTransactions = useMemo(() => {
    if (selectedCategory === 'All') return validTransactions;
    return validTransactions.filter((t) => t.category === selectedCategory);
  }, [validTransactions, selectedCategory]);

  const categorySlices: CategorySlice[] = useMemo(() => {
    const totals: Record<SpendCategory, number> = {
      Food: 0,
      Travel: 0,
      Shopping: 0,
      Academics: 0,
      Others: 0,
    };

    for (const tx of validTransactions) {
      if (
        tx.timestamp < snapshot.cycle.cycleStartMs ||
        tx.timestamp >= snapshot.cycle.cycleEndExclusiveMs
      ) {
        continue;
      }
      if (tx.direction === 'DEBIT') {
        totals[tx.category] += tx.amountPaise;
      } else if (tx.direction === 'REFUND') {
        totals[tx.category] = Math.max(0, totals[tx.category] - tx.amountPaise);
      }
    }

    return CATEGORIES.map((category) => ({
      category,
      amountPaise: totals[category],
      color: CATEGORY_COLORS[category],
    }));
  }, [validTransactions, snapshot.cycle]);

  const isOverToday = snapshot.todayRemainingPaise < 0;

  return (
    <div className="space-y-8">
      {/* Workspace toolbar (below top bar) */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Cycle {snapshot.cycle.cycleLabel} · {snapshot.cycle.daysLeftInCycle} days left · Asia/Kolkata
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onSimulateIncomingSms}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Simulate UPI SMS</span>
          </button>

          <button
            type="button"
            onClick={onOpenAddExpense}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 text-xs font-medium hover:bg-slate-800 dark:hover:bg-slate-200 whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Add Expense</span>
          </button>

          <button
            type="button"
            onClick={onOpenOnboarding}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Setup & Permissions</span>
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            className="inline-flex items-center justify-center min-h-[40px] min-w-[40px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Permission Denied Graceful Fallback Banner */}
      {settings.smsPermissionState === 'denied' && (
        <div
          className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          role="region"
          aria-label="Manual mode active"
        >
          <div className="space-y-1">
            <p className="text-sm font-semibold text-amber-950 dark:text-amber-200">
              SMS permission denied — Manual Mode active
            </p>
            <p className="text-sm text-amber-900/80 dark:text-amber-300/80">
              FinMate works without SMS access. Log expenses manually anytime or grant access later.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenAddExpense}
              className="px-3.5 py-2 min-h-[44px] rounded-lg bg-amber-900 text-white dark:bg-amber-400 dark:text-slate-950 text-xs font-medium whitespace-nowrap"
            >
              Add Expense
            </button>
            <button
              type="button"
              onClick={onGrantSmsLater}
              className="px-3.5 py-2 min-h-[44px] rounded-lg border border-amber-400 dark:border-amber-700 text-amber-950 dark:text-amber-200 text-xs font-medium whitespace-nowrap"
            >
              Grant Access Later
            </button>
          </div>
        </div>
      )}

      {/* Dominant Visual Anchor: Daily Safe-to-Spend Hero */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-3">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Today&apos;s Safe-to-Spend Limit
            </p>
            <div className="flex flex-wrap items-baseline gap-4">
              <h1 className="font-display text-5xl sm:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50 tabular-nums">
                {formatInr(snapshot.dailyLimitPaise)}
              </h1>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                per day for {snapshot.cycle.daysLeftInCycle} days
              </span>
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              {isOverToday ? (
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="tabular-nums">
                    Over today&apos;s limit by {formatInr(Math.abs(snapshot.todayRemainingPaise))} · Spent today {formatInr(snapshot.spentTodayPaise)}
                  </span>
                </div>
              ) : (
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400 tabular-nums">
                  Remaining today: {formatInr(snapshot.todayRemainingPaise)} · Spent today:{' '}
                  {formatInr(snapshot.spentTodayPaise)}
                </p>
              )}
            </div>
          </div>

          <div className="lg:col-span-5 grid grid-cols-2 gap-4 pt-4 lg:pt-0 lg:border-l lg:border-slate-200 dark:lg:border-slate-800 lg:pl-8">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Spent this cycle</p>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-1">
                {formatInr(snapshot.spentThisCyclePaise)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                Refunds: {formatInr(snapshot.refundsThisCyclePaise)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Remaining pool</p>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-1">
                {formatInr(snapshot.remainingAllowancePaise)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                Allowance: {formatInr(settings.allowancePaise)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Fixed commitments</p>
              <p className="text-base font-semibold text-slate-800 dark:text-slate-200 tabular-nums mt-1">
                {formatInr(settings.fixedCommitmentsPaise)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Goal proration</p>
              <button
                type="button"
                onClick={onOpenGoalTab}
                className="text-left text-base font-semibold text-emerald-700 dark:text-emerald-400 hover:underline tabular-nums mt-1 cursor-pointer"
              >
                {goal ? formatInr(snapshot.savingsPlannedThisCyclePaise) : 'Set a goal'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* "Check These" Ambiguous SMS Review Queue */}
      {needsReviewItems.length > 0 && (
        <section className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Check these ({needsReviewItems.length})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Low-confidence alerts paused so FinMate never guesses your balance.
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {needsReviewItems.map((tx) => {
              const draftAmt =
                reviewAmounts[tx.id] ?? (tx.amountPaise > 0 ? String(tx.amountPaise / 100) : '');
              const draftDir = reviewDirs[tx.id] ?? tx.direction;
              return (
                <div
                  key={tx.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {tx.merchant}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {tx.mode} · {formatKolkataDate(tx.timestamp)}
                      {tx.upiRef ? ` · Ref ${tx.upiRef}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      placeholder="Amount ₹"
                      value={draftAmt}
                      onChange={(e) =>
                        setReviewAmounts((prev) => ({ ...prev, [tx.id]: e.target.value }))
                      }
                      className="w-28 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-sm tabular-nums"
                    />
                    <select
                      value={draftDir}
                      onChange={(e) =>
                        setReviewDirs((prev) => ({
                          ...prev,
                          [tx.id]: e.target.value as TransactionDirection,
                        }))
                      }
                      className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-sm"
                    >
                      <option value="DEBIT">Debit</option>
                      <option value="CREDIT">Credit</option>
                      <option value="REFUND">Refund</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        const val = Number(draftAmt);
                        if (Number.isFinite(val) && val > 0) {
                          onResolveReview(tx.id, Math.round(val * 100), draftDir);
                        }
                      }}
                      className="px-3.5 py-1.5 min-h-[38px] rounded-lg bg-emerald-700 text-white text-xs font-medium hover:bg-emerald-800 dark:bg-emerald-500 dark:text-slate-950"
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Main 2-Column Content: Category Breakdown + Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Category Breakdown Donut */}
        <section className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Category Breakdown
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Click any category to filter transactions
              </p>
            </div>
            {selectedCategory !== 'All' && (
              <button
                type="button"
                onClick={() => setSelectedCategory('All')}
                className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
              >
                Show all
              </button>
            )}
          </div>

          <DonutChart
            slices={categorySlices}
            activeCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
        </section>

        {/* Recent Transactions */}
        <section className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Recent Transactions
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Changing a category remembers that merchant for future alerts
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenSmsLab}
              className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap"
            >
              Test custom bank SMS →
            </button>
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="py-12 text-center space-y-3 border-t border-slate-200 dark:border-slate-800">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                No transactions in {selectedCategory === 'All' ? 'this cycle yet' : selectedCategory}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Simulate an incoming bank SMS or log an expense manually to see Safe-to-Spend update.
              </p>
              <div className="flex items-center justify-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={onOpenAddExpense}
                  className="px-4 py-2 min-h-[40px] rounded-lg bg-emerald-700 text-white text-xs font-medium"
                >
                  Add Expense
                </button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredTransactions.map((tx) => {
                const isDebit = tx.direction === 'DEBIT';
                const hasOverride = Boolean(merchantOverrides[tx.merchantKey]);
                return (
                  <div
                    key={tx.id}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isDebit
                            ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        }`}
                      >
                        {isDebit ? (
                          <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
                        ) : (
                          <ArrowDownLeft className="w-4 h-4" aria-hidden="true" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {tx.merchant}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {tx.mode.replace('_', ' ')} · {formatKolkataDate(tx.timestamp)}
                          {tx.accountLast4 ? ` · A/c *${tx.accountLast4}` : ''}
                          {tx.upiRef ? ` · Ref ${tx.upiRef}` : ''}
                          {hasOverride ? ' · Remembered choice' : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pl-11 sm:pl-0">
                      <select
                        aria-label={`Category for ${tx.merchant}`}
                        value={tx.category}
                        onChange={(e) =>
                          onChangeCategory(tx.id, e.target.value as SpendCategory)
                        }
                        className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 min-h-[36px]"
                      >
                        {CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>

                      <span
                        className={`text-sm font-bold tabular-nums min-w-[84px] text-right ${
                          isDebit
                            ? 'text-slate-900 dark:text-slate-100'
                            : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {isDebit ? '-' : '+'}
                        {formatInr(tx.amountPaise).replace(/^[+-]/, '')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
