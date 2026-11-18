import React, { useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { isValidReferralCode } from '../engine/formatters';
import { UserSettings } from '../engine/types';

interface OnboardingModalProps {
  initialSettings: UserSettings;
  onComplete: (updated: {
    allowancePaise: number;
    allowanceDay: number;
    fixedCommitmentsPaise: number;
    referralCode?: string;
    smsGranted: boolean;
    variant: 'A' | 'B';
  }) => void;
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  initialSettings,
  onComplete,
  onClose,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [allowanceRupees, setAllowanceRupees] = useState(
    String(Math.round(initialSettings.allowancePaise / 100))
  );
  const [allowanceDay, setAllowanceDay] = useState(String(initialSettings.allowanceDay));
  const [fixedRupees, setFixedRupees] = useState(
    String(Math.round(initialSettings.fixedCommitmentsPaise / 100))
  );
  const [referralCode, setReferralCode] = useState(initialSettings.referralCode ?? '');
  const [variant, setVariant] = useState<'A' | 'B'>(initialSettings.onboardingVariant);
  const [error, setError] = useState('');

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    const allowanceVal = Number(allowanceRupees);
    const dayVal = Number(allowanceDay);
    const fixedVal = Number(fixedRupees || '0');

    if (!Number.isFinite(allowanceVal) || allowanceVal < 500) {
      setError('Enter a monthly allowance of at least ₹500.');
      return;
    }
    if (!Number.isInteger(dayVal) || dayVal < 1 || dayVal > 31) {
      setError('Allowance date must be a day between 1 and 31.');
      return;
    }
    if (!Number.isFinite(fixedVal) || fixedVal < 0) {
      setError('Fixed commitments cannot be negative.');
      return;
    }
    if (!isValidReferralCode(referralCode)) {
      setError('Referral code must be 4–8 letters or numbers (or leave blank).');
      return;
    }

    setError('');
    setStep(2);
  };

  const finish = (smsGranted: boolean) => {
    onComplete({
      allowancePaise: Math.round(Number(allowanceRupees) * 100),
      allowanceDay: Number(allowanceDay),
      fixedCommitmentsPaise: Math.round(Number(fixedRupees || '0') * 100),
      referralCode: referralCode.trim() ? referralCode.trim().toUpperCase() : undefined,
      smsGranted,
      variant,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              Step {step} of 2 · Onboarding Setup
            </p>
            <h2
              id="onboarding-title"
              className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1"
            >
              {step === 1 ? 'Set your monthly allowance' : 'Automatic UPI tracking'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close setup"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === 1 ? (
          <form onSubmit={handleStep1} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Monthly Allowance (₹)
              </label>
              <input
                type="number"
                value={allowanceRupees}
                onChange={(e) => setAllowanceRupees(e.target.value)}
                min={500}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm tabular-nums text-slate-900 dark:text-slate-100"
                placeholder="10000"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Allowance Date (Day 1–31)
                </label>
                <input
                  type="number"
                  value={allowanceDay}
                  onChange={(e) => setAllowanceDay(e.target.value)}
                  min={1}
                  max={31}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm tabular-nums text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Fixed Rent / Recharge (₹)
                </label>
                <input
                  type="number"
                  value={fixedRupees}
                  onChange={(e) => setFixedRupees(e.target.value)}
                  min={0}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm tabular-nums text-slate-900 dark:text-slate-100"
                  placeholder="2500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Ambassador / Referral Code (Optional, 4–8 chars)
              </label>
              <input
                type="text"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.slice(0, 8))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm uppercase text-slate-900 dark:text-slate-100"
                placeholder="DU2026"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            )}

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="submit"
                className="w-full sm:w-auto px-5 py-2.5 min-h-[44px] rounded-lg bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800 dark:bg-emerald-500 dark:text-slate-950"
              >
                Continue to SMS Permission
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Preview A/B Onboarding Copy
              </span>
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setVariant('A')}
                  className={`px-3 py-1 text-xs font-medium rounded-md ${
                    variant === 'A'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Variant A (Privacy)
                </button>
                <button
                  type="button"
                  onClick={() => setVariant('B')}
                  className={`px-3 py-1 text-xs font-medium rounded-md ${
                    variant === 'B'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Variant B (Plain)
                </button>
              </div>
            </div>

            {variant === 'A' ? (
              <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold text-sm">
                  <ShieldCheck className="w-5 h-5 shrink-0" />
                  <span>Private, on-device parsing</span>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  FinMate only reads bank/UPI transaction alerts. OTPs and personal messages are
                  ignored. Everything stays on your phone.
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed py-2">
                Allow SMS permission so FinMate can automatically track your UPI and debit card
                transactions.
              </p>
            )}

            <div className="flex flex-col gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => finish(true)}
                className="w-full min-h-[48px] rounded-lg bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800 dark:bg-emerald-500 dark:text-slate-950"
              >
                Allow SMS Access & Backfill 60 Days
              </button>
              <button
                type="button"
                onClick={() => finish(false)}
                className="w-full min-h-[48px] rounded-lg border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Deny SMS (Use Manual Entry Instead)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
