import React, { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { formatKolkataDate } from '../engine/formatters';
import { AnalyticsEvent, UserSettings } from '../engine/types';

interface PilotMetricsViewProps {
  events: AnalyticsEvent[];
  settings: UserSettings;
  onResetEvents?: () => void;
}

export const PilotMetricsView: React.FC<PilotMetricsViewProps> = ({
  events,
  settings,
}) => {
  const [uploadFlagEnabled, setUploadFlagEnabled] = useState(false);

  const metrics = useMemo(() => {
    const installs = events.filter((e) => e.event === 'app_installed').length;
    const activations = events.filter((e) => e.event === 'first_transaction_tracked').length;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weeklyOpens = events.filter(
      (e) => e.event === 'app_open' && e.timestamp >= sevenDaysAgo
    ).length;
    const grants = events.filter((e) => e.event === 'sms_permission_granted').length;
    const denials = events.filter((e) => e.event === 'sms_permission_denied').length;

    const activationRate =
      installs > 0 ? Math.min(100, Math.round((activations / installs) * 100)) : 0;

    return {
      installs,
      activations,
      activationRate,
      weeklyOpens,
      grants,
      denials,
    };
  }, [events]);

  const exportCsv = () => {
    const rows = [
      'id,event_name,variant,timestamp_ms,metadata',
      ...events.map((e) => {
        const meta = JSON.stringify(e.meta ?? {}).replace(/"/g, '""');
        return `${e.id},${e.event},${e.variant},${e.timestamp},"${meta}"`;
      }),
    ].join('\n');

    const blob = new Blob([rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'finmate_analytics.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Pilot Analytics & Debug View
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Computed strictly from on-device events. Zero PII or SMS content is ever logged.
          </p>
        </div>

        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-lg bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800 dark:bg-emerald-500 dark:text-slate-950 self-start cursor-pointer"
        >
          <Download className="w-4 h-4" aria-hidden="true" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* 4-Column Metric Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Activation Rate</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-1">
            {metrics.activationRate}%
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
            {metrics.activations} first-tx / {metrics.installs} install
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Weekly Opens</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-1">
            {metrics.weeklyOpens}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Last 7 days</p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">SMS Permission</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-1">
            {metrics.grants} / {metrics.denials}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Granted / Denied (Variant {settings.onboardingVariant})
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Referral Code</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono mt-1">
            {settings.referralCode || 'None'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Validated 4–8 alphanumeric
          </p>
        </div>
      </div>

      {/* Feature-Flagged Upload Hook */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Optional Telemetry Upload Hook (`ENABLE_ANALYTICS_UPLOAD`)
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Off by default in Android `BuildConfig`. Only non-PII event counts are eligible if enabled.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setUploadFlagEnabled((v) => !v)}
          className={`px-4 py-2 min-h-[40px] rounded-lg border text-xs font-medium whitespace-nowrap ${
            uploadFlagEnabled
              ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
              : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
          }`}
        >
          Flag: {uploadFlagEnabled ? 'Enabled (Dry Run)' : 'Disabled (Default)'}
        </button>
      </div>

      {/* Event Log Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
          Local Event Stream ({events.length})
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="py-2 pr-4 font-medium">Event</th>
                <th className="py-2 pr-4 font-medium">Variant</th>
                <th className="py-2 pr-4 font-medium">Metadata (No PII)</th>
                <th className="py-2 font-medium text-right">Timestamp (IST)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {[...events]
                .sort((a, b) => b.timestamp - a.timestamp)
                .map((ev) => (
                  <tr key={ev.id}>
                    <td className="py-2.5 pr-4 font-mono font-medium text-slate-900 dark:text-slate-100">
                      {ev.event}
                    </td>
                    <td className="py-2.5 pr-4 text-slate-600 dark:text-slate-400">
                      Variant {ev.variant}
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-slate-500 dark:text-slate-400">
                      {ev.meta ? JSON.stringify(ev.meta) : '{}'}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-400">
                      {formatKolkataDate(ev.timestamp)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
