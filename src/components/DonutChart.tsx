import React from 'react';
import { formatInr } from '../engine/formatters';
import { SpendCategory } from '../engine/types';

export interface CategorySlice {
  category: SpendCategory;
  amountPaise: number;
  color: string;
}

interface DonutChartProps {
  slices: CategorySlice[];
  activeCategory: SpendCategory | 'All';
  onSelectCategory: (cat: SpendCategory | 'All') => void;
}

export const CATEGORY_COLORS: Record<SpendCategory, string> = {
  Food: '#0B6E4F',
  Travel: '#2563EB',
  Shopping: '#D97706',
  Academics: '#7C3AED',
  Others: '#64748B',
};

export const DonutChart: React.FC<DonutChartProps> = ({
  slices,
  activeCategory,
  onSelectCategory,
}) => {
  const totalPaise = slices.reduce((acc, s) => acc + s.amountPaise, 0);
  const size = 176;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativeOffset = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          role="img"
          aria-label="Spending breakdown by category"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-slate-200 dark:text-slate-800"
            strokeWidth={strokeWidth}
          />
          {totalPaise > 0 &&
            slices
              .filter((s) => s.amountPaise > 0)
              .map((slice) => {
                const fraction = slice.amountPaise / totalPaise;
                const dashLength = fraction * circumference;
                const dashArray = `${Math.max(0, dashLength - 2)} ${circumference}`;
                const dashOffset = -cumulativeOffset;
                cumulativeOffset += dashLength;
                const isDimmed = activeCategory !== 'All' && activeCategory !== slice.category;

                return (
                  <circle
                    key={slice.category}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={slice.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={dashArray}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="butt"
                    className="cursor-pointer transition-opacity duration-150"
                    style={{ opacity: isDimmed ? 0.25 : 1 }}
                    onClick={() =>
                      onSelectCategory(
                        activeCategory === slice.category ? 'All' : slice.category
                      )
                    }
                  />
                );
              })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-4">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {activeCategory === 'All' ? 'Total Spent' : activeCategory}
          </span>
          <span className="text-base font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {formatInr(
              activeCategory === 'All'
                ? totalPaise
                : slices.find((s) => s.category === activeCategory)?.amountPaise ?? 0
            )}
          </span>
        </div>
      </div>

      <div className="flex-1 w-full divide-y divide-slate-200/70 dark:divide-slate-800">
        {slices.map((slice) => {
          const pct = totalPaise > 0 ? Math.round((slice.amountPaise / totalPaise) * 100) : 0;
          const isSelected = activeCategory === slice.category;
          return (
            <button
              key={slice.category}
              type="button"
              onClick={() => onSelectCategory(isSelected ? 'All' : slice.category)}
              className={`w-full flex items-center justify-between py-2.5 px-2 text-left rounded-md transition-colors min-h-[44px] ${
                isSelected
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/40'
                  : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/50'
              }`}
            >
              <span className="flex items-center gap-2.5 text-sm font-medium text-slate-800 dark:text-slate-200">
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: slice.color }}
                  aria-hidden="true"
                />
                {slice.category}
              </span>
              <span className="text-sm tabular-nums text-slate-700 dark:text-slate-300">
                {formatInr(slice.amountPaise)}{' '}
                <span className="text-xs text-slate-500 dark:text-slate-400">({pct}%)</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
