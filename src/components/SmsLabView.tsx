import React, { useMemo, useState } from 'react';
import { CheckCircle2, Play, ShieldAlert, XCircle } from 'lucide-react';
import { formatInr } from '../engine/formatters';
import {
  BANK_SENDER_ALLOW_LIST,
  isDuplicateTransaction,
  parseBankSms,
} from '../engine/smsParser';
import { runAllDomainTests, SMS_PARSER_TEST_SUITE } from '../engine/testSuites';
import { SpendCategory, TransactionRecord } from '../engine/types';

interface SmsLabViewProps {
  existingTransactions: TransactionRecord[];
  merchantOverrides: Record<string, SpendCategory>;
  onInjectParsedSms: (sender: string, body: string) => {
    added: boolean;
    message: string;
  };
}

export const SmsLabView: React.FC<SmsLabViewProps> = ({
  existingTransactions,
  merchantOverrides,
  onInjectParsedSms,
}) => {
  const [sender, setSender] = useState('AD-HDFCBK');
  const [body, setBody] = useState(
    'Amt Sent Rs.180.00 From HDFC Bank A/C *4821 To Swiggy On 18-11 Ref 432319847120.'
  );
  const [injectStatus, setInjectStatus] = useState<string>('');
  const [testFilter, setTestFilter] = useState<'all' | 'failed'>('all');

  const liveOutcome = useMemo(
    () => parseBankSms({ sender, body, receivedAtMs: Date.now() }, merchantOverrides),
    [sender, body, merchantOverrides]
  );

  const isDup = useMemo(() => {
    if (liveOutcome.status !== 'parsed') return false;
    return isDuplicateTransaction(liveOutcome.transaction, existingTransactions);
  }, [liveOutcome, existingTransactions]);

  const suiteReport = useMemo(() => runAllDomainTests(), []);

  const visibleTests = useMemo(() => {
    if (testFilter === 'failed') return suiteReport.results.filter((r) => !r.passed);
    return suiteReport.results;
  }, [suiteReport, testFilter]);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Interactive SMS Parser Sandbox */}
        <section className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              On-Device SMS Parser Lab
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Test any Indian bank or UPI alert. Raw SMS text is parsed in memory and never persisted.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Load Sample SMS
              </label>
              <select
                onChange={(e) => {
                  const found = SMS_PARSER_TEST_SUITE.find((t) => t.id === e.target.value);
                  if (found) {
                    setSender(found.sender);
                    setBody(found.body);
                    setInjectStatus('');
                  }
                }}
                defaultValue="SMS-01"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
              >
                {SMS_PARSER_TEST_SUITE.map((tc) => (
                  <option key={tc.id} value={tc.id}>
                    {tc.id} · {tc.bank} — {tc.note}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Sender ID (DLT Allow-List: {BANK_SENDER_ALLOW_LIST.slice(0, 6).join(', ')}...)
              </label>
              <input
                type="text"
                value={sender}
                onChange={(e) => {
                  setSender(e.target.value);
                  setInjectStatus('');
                }}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono text-sm text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Raw SMS Body
              </label>
              <textarea
                rows={3}
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  setInjectStatus('');
                }}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono text-xs leading-relaxed text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                const res = onInjectParsedSms(sender, body);
                setInjectStatus(res.message);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-lg bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800 dark:bg-emerald-500 dark:text-slate-950 cursor-pointer"
            >
              <Play className="w-4 h-4" aria-hidden="true" />
              <span>Simulate RECEIVE_SMS to Dashboard</span>
            </button>

            {injectStatus && (
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                {injectStatus}
              </span>
            )}
          </div>
        </section>

        {/* Live Extracted Fields Output */}
        <section className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Extracted Structured Output
          </h2>

          {liveOutcome.status === 'ignored' ? (
            <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800/70 space-y-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Ignored (Not Stored)
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">{liveOutcome.reason}</p>
            </div>
          ) : (
            <dl className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-slate-500 dark:text-slate-400">Status</dt>
                <dd className="font-semibold text-slate-900 dark:text-slate-100">
                  {liveOutcome.transaction.needsReview ? (
                    <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                      <ShieldAlert className="w-4 h-4" /> Needs Review (&quot;Check these&quot;)
                    </span>
                  ) : isDup ? (
                    <span className="text-amber-700 dark:text-amber-400">
                      Duplicate Detected (Skipped)
                    </span>
                  ) : (
                    <span className="text-emerald-700 dark:text-emerald-400">
                      Confident Parse
                    </span>
                  )}
                </dd>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-slate-500 dark:text-slate-400">Amount (Long paise)</dt>
                <dd className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  {formatInr(liveOutcome.transaction.amountPaise)} ({liveOutcome.transaction.amountPaise} paise)
                </dd>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-slate-500 dark:text-slate-400">Direction & Mode</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100">
                  {liveOutcome.transaction.direction} · {liveOutcome.transaction.mode}
                </dd>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-slate-500 dark:text-slate-400">Merchant</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100">
                  {liveOutcome.transaction.merchant}
                </dd>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-slate-500 dark:text-slate-400">Category</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100">
                  {liveOutcome.transaction.category} ({liveOutcome.transaction.categorySource})
                </dd>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-slate-500 dark:text-slate-400">UPI Ref / Account</dt>
                <dd className="font-mono text-xs text-slate-800 dark:text-slate-200">
                  {liveOutcome.transaction.upiRef ?? '—'} /{' '}
                  {liveOutcome.transaction.accountLast4
                    ? `*${liveOutcome.transaction.accountLast4}`
                    : '—'}
                </dd>
              </div>
            </dl>
          )}
        </section>
      </div>

      {/* Live 34-Case Unit Test Suite Report */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Verified Unit Test Suite ({suiteReport.passed}/{suiteReport.total} SMS ·{' '}
              {suiteReport.budgetTestsPassed}/{suiteReport.budgetTestsTotal} Budget Boundaries)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              Categorisation accuracy: {suiteReport.categoryAccuracyPct}% (target ≥ 90%) ·
              Deduplication: {suiteReport.dedupPassed ? 'Passed' : 'Failed'} · All samples marked synthetic
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 self-start">
            <button
              type="button"
              onClick={() => setTestFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                testFilter === 'all'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              All ({suiteReport.total})
            </button>
            <button
              type="button"
              onClick={() => setTestFilter('failed')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                testFilter === 'failed'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Failed ({suiteReport.total - suiteReport.passed})
            </button>
          </div>
        </div>

        {/* Safe-to-Spend Boundary Test Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {suiteReport.budgetResults.map((b) => (
            <div
              key={b.name}
              className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                {b.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span>{b.name}</span>
              </div>
              <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-1">
                {b.detail}
              </p>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto border-t border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="py-2.5 pr-4 font-medium">Case</th>
                <th className="py-2.5 pr-4 font-medium">Bank</th>
                <th className="py-2.5 pr-4 font-medium">Scenario</th>
                <th className="py-2.5 pr-4 font-medium">Parser Output</th>
                <th className="py-2.5 font-medium text-right">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {visibleTests.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                  <td className="py-2.5 pr-4 font-mono text-slate-700 dark:text-slate-300">
                    {r.id}
                  </td>
                  <td className="py-2.5 pr-4 text-slate-700 dark:text-slate-300">{r.bank}</td>
                  <td className="py-2.5 pr-4 text-slate-800 dark:text-slate-200">{r.note}</td>
                  <td className="py-2.5 pr-4 font-mono text-slate-600 dark:text-slate-400">
                    {r.details}
                  </td>
                  <td className="py-2.5 text-right font-semibold">
                    {r.passed ? (
                      <span className="text-emerald-700 dark:text-emerald-400">PASS</span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400">FAIL</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
