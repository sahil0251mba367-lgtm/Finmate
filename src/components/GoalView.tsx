import React, { useState } from 'react';
import { PiggyBank, Plus } from 'lucide-react';
import { formatInr } from '../engine/formatters';
import { computeSavingsPlannedPaise } from '../engine/safeToSpend';
import { SavingsGoal } from '../engine/types';

interface GoalViewProps {
  goal: SavingsGoal | null;
  onSaveGoal: (goal: SavingsGoal) => void;
  onContribute: (amountPaise: number) => void;
  onClearGoal: () => void;
}

export const GoalView: React.FC<GoalViewProps> = ({
  goal,
  onSaveGoal,
  onContribute,
  onClearGoal,
}) => {
  const [name, setName] = useState(goal?.name ?? 'College Fest & Headphones');
  const [targetRupees, setTargetRupees] = useState(
    goal ? String(Math.round(goal.targetPaise / 100)) : '5000'
  );
  const [targetDateIso, setTargetDateIso] = useState(goal?.targetDateIso ?? '2027-02-15');
  const [customContrib, setCustomContrib] = useState('');
  const [editing, setEditing] = useState(!goal);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const targetNum = Number(targetRupees);
    if (!name.trim() || !Number.isFinite(targetNum) || targetNum <= 0) return;
    onSaveGoal({
      id: goal?.id ?? 'goal-1',
      name: name.trim(),
      targetPaise: Math.round(targetNum * 100),
      targetDateIso,
      savedPaise: goal?.savedPaise ?? 0,
    });
    setEditing(false);
  };

  const progressPct =
    goal && goal.targetPaise > 0
      ? Math.min(100, Math.round((goal.savedPaise / goal.targetPaise) * 100))
      : 0;
  const monthlyPlanned = computeSavingsPlannedPaise(goal);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
              <PiggyBank className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {goal ? goal.name : 'Create Your Savings Goal'}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                One focused goal at a time · Automatically reserves monthly savings in Safe-to-Spend
              </p>
            </div>
          </div>

          {goal && !editing && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-xs font-medium text-slate-700 dark:text-slate-300 hover:underline"
              >
                Edit goal
              </button>
              <button
                type="button"
                onClick={onClearGoal}
                className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline"
              >
                Remove
              </button>
            </div>
          )}
        </div>

        {goal && !editing ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                  {formatInr(goal.savedPaise)}{' '}
                  <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                    of {formatInr(goal.targetPaise)}
                  </span>
                </span>
                <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {progressPct}%
                </span>
              </div>

              <div
                className="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden"
                role="progressbar"
                aria-valuenow={progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full bg-emerald-700 dark:bg-emerald-400 transition-all duration-200"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                Target date: {goal.targetDateIso} · Monthly Safe-to-Spend reserve:{' '}
                {formatInr(monthlyPlanned)}
              </p>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Add Manual Contribution
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {[10000, 25000, 50000].map((paise) => (
                  <button
                    key={paise}
                    type="button"
                    onClick={() => onContribute(paise)}
                    className="inline-flex items-center gap-1 px-4 py-2 min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 tabular-nums"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{formatInr(paise)}</span>
                  </button>
                ))}

                <div className="flex items-center gap-2 ml-auto">
                  <input
                    type="number"
                    placeholder="Custom ₹"
                    value={customContrib}
                    onChange={(e) => setCustomContrib(e.target.value)}
                    className="w-28 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm tabular-nums"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const v = Number(customContrib);
                      if (Number.isFinite(v) && v > 0) {
                        onContribute(Math.round(v * 100));
                        setCustomContrib('');
                      }
                    }}
                    className="px-4 py-2 min-h-[44px] rounded-lg bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800 dark:bg-emerald-500 dark:text-slate-950"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Goal Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm"
                placeholder="Semester Trip, Headphones..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Target Amount (₹)
                </label>
                <input
                  type="number"
                  value={targetRupees}
                  onChange={(e) => setTargetRupees(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Target Date
                </label>
                <input
                  type="date"
                  value={targetDateIso}
                  onChange={(e) => setTargetDateIso(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                className="px-5 py-2.5 min-h-[44px] rounded-lg bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800 dark:bg-emerald-500 dark:text-slate-950"
              >
                Save Goal
              </button>
              {goal && (
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="px-4 py-2.5 min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
