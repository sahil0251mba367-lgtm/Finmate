import React, { useMemo, useState } from 'react';
import { Check, CheckSquare, Copy, Download, FileCode2, FolderGit2, Square } from 'lucide-react';
import { ALL_ANDROID_REPO_FILES } from '../repo';

interface GitHubRepoViewProps {
  onDownloadZip: () => void;
}

const ACCEPTANCE_CHECKLIST = [
  'Fresh install -> onboarding -> grant SMS -> past 60 days of bank SMS appear as categorised transactions',
  'New UPI debit SMS appears within seconds and updates daily Safe-to-Spend limit',
  'SmsParserTest & SafeToSpendCalculatorTest pass with >= 90% categorisation accuracy',
  'Denying SMS permission never crashes the app; manual Add Expense works seamlessly',
  'Changing a category saves MerchantCategoryOverride and applies to future alerts',
  'Single savings goal progress bar & manual contribution updates Safe-to-Spend',
  'No raw SMS body text is ever stored, logged, or transmitted off-device',
];

export const GitHubRepoView: React.FC<GitHubRepoViewProps> = ({ onDownloadZip }) => {
  const [selectedPath, setSelectedPath] = useState(ALL_ANDROID_REPO_FILES[0].path);
  const [copiedFile, setCopiedFile] = useState(false);
  const [copiedGit, setCopiedGit] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({
    0: true,
    1: true,
    2: true,
    3: true,
  });

  const activeFile = useMemo(
    () =>
      ALL_ANDROID_REPO_FILES.find((f) => f.path === selectedPath) ?? ALL_ANDROID_REPO_FILES[0],
    [selectedPath]
  );

  const gitCommands = `unzip FinMate-Android-MVP.zip -d finmate-android
cd finmate-android
git init
git add .
git commit -m "feat: FinMate Android MVP (Kotlin, Compose, Room, Hilt, WorkManager)"
git branch -M main
git remote add origin https://github.com/<your-username>/finmate-android.git
git push -u origin main`;

  const copyText = async (text: string, which: 'file' | 'git') => {
    try {
      await navigator.clipboard.writeText(text);
      if (which === 'file') {
        setCopiedFile(true);
        setTimeout(() => setCopiedFile(false), 1800);
      } else {
        setCopiedGit(true);
        setTimeout(() => setCopiedGit(false), 1800);
      }
    } catch {
      // Clipboard fallback ignored cleanly
    }
  };

  return (
    <div className="space-y-8">
      {/* GitHub Export Header */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <FolderGit2 className="w-4 h-4" aria-hidden="true" />
              <span>GitHub-Ready Android Kotlin / Jetpack Compose Repository</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
              Export Complete FinMate Android MVP to GitHub
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Includes all {ALL_ANDROID_REPO_FILES.length} project files across Phases 1–9: pinned
              Gradle version catalog (`AGP 9.4.0`, `Kotlin 2.4.20`, `Room 2.8.5`, `Hilt 2.60.1`),
              pure-Kotlin `SmsParser` + 32 unit tests, `SafeToSpendCalculator` + boundary tests,
              Room/DataStore/WorkManager pipeline, Material 3 Compose UI, and `README.md` with
              Play Store Distribution notes.
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onDownloadZip}
                className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-lg bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800 dark:bg-emerald-500 dark:text-slate-950 cursor-pointer"
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                <span>Download FinMate-Android-MVP.zip</span>
              </button>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Verify locally with <code className="font-mono">./gradlew test assembleDebug</code>
              </span>
            </div>
          </div>

          <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 text-slate-100 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Push to GitHub</span>
              <button
                type="button"
                onClick={() => copyText(gitCommands, 'git')}
                className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 cursor-pointer"
              >
                {copiedGit ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedGit ? 'Copied' : 'Copy commands'}</span>
              </button>
            </div>
            <pre className="text-xs font-mono leading-relaxed overflow-x-auto text-slate-200">
              {gitCommands}
            </pre>
          </div>
        </div>
      </section>

      {/* Interactive Repository File Explorer */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[540px]">
          <aside className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-4 space-y-1 overflow-y-auto max-h-[600px]">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 px-2 pb-2">
              Repository Files ({ALL_ANDROID_REPO_FILES.length})
            </p>
            {ALL_ANDROID_REPO_FILES.map((file) => {
              const active = file.path === activeFile.path;
              return (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => setSelectedPath(file.path)}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors flex items-start gap-2 cursor-pointer ${
                    active
                      ? 'bg-emerald-700 text-white dark:bg-emerald-500 dark:text-slate-950 font-medium'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800/70'
                  }`}
                >
                  <FileCode2 className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
                  <span className="font-mono break-all">{file.path}</span>
                </button>
              );
            })}
          </aside>

          <div className="lg:col-span-8 flex flex-col">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {activeFile.path}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {activeFile.phase} · {activeFile.description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => copyText(activeFile.content, 'file')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                {copiedFile ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedFile ? 'Copied' : 'Copy file'}</span>
              </button>
            </div>

            <pre className="flex-1 p-5 overflow-auto max-h-[540px] bg-slate-950 text-slate-100 font-mono text-xs leading-relaxed">
              <code>{activeFile.content}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* MVP Acceptance Checklist */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            MVP Acceptance Checklist
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Track verification across your local Android Studio build and pilot device test.
          </p>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {ACCEPTANCE_CHECKLIST.map((item, idx) => {
            const checked = Boolean(checkedItems[idx]);
            return (
              <button
                key={item}
                type="button"
                onClick={() =>
                  setCheckedItems((prev) => ({ ...prev, [idx]: !prev[idx] }))
                }
                className="w-full py-3 flex items-start gap-3 text-left min-h-[44px] hover:bg-slate-50/60 dark:hover:bg-slate-800/30 px-2 rounded-lg cursor-pointer"
              >
                {checked ? (
                  <CheckSquare className="w-4 h-4 text-emerald-700 dark:text-emerald-400 mt-0.5 shrink-0" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                )}
                <span
                  className={`text-sm ${
                    checked
                      ? 'text-slate-900 dark:text-slate-100 font-medium'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {item}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};
