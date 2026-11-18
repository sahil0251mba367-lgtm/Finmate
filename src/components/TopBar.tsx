import React from 'react';
import { Download } from 'lucide-react';

export type AppTab = 'dashboard' | 'sms-lab' | 'goal' | 'metrics' | 'github';

interface TopBarProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  onDownloadZip: () => void;
}

const NAV_ITEMS: { id: AppTab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'sms-lab', label: 'SMS Lab' },
  { id: 'goal', label: 'Savings Goal' },
  { id: 'metrics', label: 'Pilot Metrics' },
  { id: 'github', label: 'GitHub Repo' },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
  onDownloadZip,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
        {/* Zone 1: Single-element brand wordmark */}
        <button
          type="button"
          onClick={() => onSelectTab('dashboard')}
          className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
        >
          FinMate
        </button>

        {/* Zone 2: 5 clean single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`py-2 text-sm font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
                  active
                    ? 'border-emerald-700 text-emerald-800 dark:border-emerald-400 dark:text-emerald-300'
                    : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onDownloadZip}
            className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-lg text-sm font-medium bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Download Repo</span>
          </button>
        </div>
      </div>

      {/* Mobile navigation strip (compact single-line horizontal scroll, <=15% viewport height) */}
      <nav
        className="md:hidden flex items-center gap-4 px-4 overflow-x-auto border-t border-slate-100 dark:border-slate-900"
        aria-label="Mobile navigation"
      >
        {NAV_ITEMS.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`min-h-[44px] text-xs font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors ${
                active
                  ? 'border-emerald-700 text-emerald-800 dark:border-emerald-400 dark:text-emerald-300'
                  : 'border-transparent text-slate-600 dark:text-slate-400'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
