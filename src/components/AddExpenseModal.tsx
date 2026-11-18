import React, { useState } from 'react';
import { X } from 'lucide-react';
import { PaymentMode, SpendCategory, TransactionDirection } from '../engine/types';

interface AddExpenseModalProps {
  onAdd: (entry: {
    amountPaise: number;
    merchant: string;
    category: SpendCategory;
    direction: TransactionDirection;
    mode: PaymentMode;
  }) => void;
  onClose: () => void;
}

const CATEGORIES: SpendCategory[] = ['Food', 'Travel', 'Shopping', 'Academics', 'Others'];

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({ onAdd, onClose }) => {
  const [amountStr, setAmountStr] = useState('');
  const [merchant, setMerchant] = useState('');
  const [category, setCategory] = useState<SpendCategory>('Food');
  const [direction, setDirection] = useState<TransactionDirection>('DEBIT');
  const [mode, setMode] = useState<PaymentMode>('UPI');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(amountStr);
    if (!Number.isFinite(num) || num <= 0) {
      setError('Enter a valid amount greater than ₹0.');
      return;
    }
    if (!merchant.trim()) {
      setError('Enter a merchant or description (e.g. Hostel Canteen).');
      return;
    }

    onAdd({
      amountPaise: Math.round(num * 100),
      merchant: merchant.trim(),
      category,
      direction,
      mode,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-expense-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 id="add-expense-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Add Expense
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close add expense dialog"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
            {(['DEBIT', 'REFUND', 'CREDIT'] as TransactionDirection[]).map((dir) => (
              <button
                key={dir}
                type="button"
                onClick={() => setDirection(dir)}
                className={`py-2 text-xs font-medium rounded-md transition-colors ${
                  direction === dir
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {dir === 'DEBIT' ? 'Expense' : dir === 'REFUND' ? 'Refund' : 'Income'}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Amount (₹)
            </label>
            <input
              type="number"
              step="0.01"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="120"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm tabular-nums text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Merchant / Place
            </label>
            <input
              type="text"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="Campus Canteen, Metro, Xerox..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as SpendCategory)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Payment Mode
              </label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as PaymentMode)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="UPI">UPI</option>
                <option value="DEBIT_CARD">Debit Card</option>
                <option value="ATM">ATM / Cash</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full min-h-[48px] rounded-lg bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800 dark:bg-emerald-500 dark:text-slate-950"
          >
            Save Entry
          </button>
        </form>
      </div>
    </div>
  );
};
