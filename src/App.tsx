import { useEffect, useMemo, useState } from 'react';
import { AddExpenseModal } from './components/AddExpenseModal';
import { DashboardView } from './components/DashboardView';
import { GitHubRepoView } from './components/GitHubRepoView';
import { GoalView } from './components/GoalView';
import { OnboardingModal } from './components/OnboardingModal';
import { PilotMetricsView } from './components/PilotMetricsView';
import { SmsLabView } from './components/SmsLabView';
import { AppTab, TopBar } from './components/TopBar';
import { calculateSafeToSpend } from './engine/safeToSpend';
import {
  isDuplicateTransaction,
  normalizeMerchantKey,
  parseBankSms,
} from './engine/smsParser';
import {
  AnalyticsEvent,
  AnalyticsEventName,
  PaymentMode,
  SavingsGoal,
  SpendCategory,
  TransactionDirection,
  TransactionRecord,
  UserSettings,
} from './engine/types';
import { ALL_ANDROID_REPO_FILES } from './repo';
import { triggerZipDownload } from './utils/zipBuilder';

const STORAGE_KEY = 'finmate_mvp_state_v1';

interface PersistedState {
  settings: UserSettings;
  transactions: TransactionRecord[];
  merchantOverrides: Record<string, SpendCategory>;
  goal: SavingsGoal | null;
  events: AnalyticsEvent[];
  darkMode: boolean;
}

function buildSeedState(): PersistedState {
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;

  const seedSms: { sender: string; body: string; offsetMs: number }[] = [
    {
      sender: 'AD-HDFCBK',
      body: 'Amt Sent Rs.180.00 From HDFC Bank A/C *4821 To Swiggy On 18-11 Ref 432319847120.',
      offsetMs: -2 * hour,
    },
    {
      sender: 'AX-SBIINB',
      body: 'Dear UPI user A/C X9012 debited by 45.00 on date 18Nov26 trf to CHAI POINT Refno 632189451023.',
      offsetMs: -4 * hour,
    },
    {
      sender: 'VM-ICICIB',
      body: 'ICICI Bank Acct XX7712 debited for Rs 149.00 on 18-Nov-26; UBER INDIA SYSTEMS credited. UPI:632310293847.',
      offsetMs: -1 * day,
    },
    {
      sender: 'BX-BOBTXN',
      body: 'Rs.499.00 debited from A/c ...6209 on 17-11-26 at Udemy India. Info: UPI/632399887766.',
      offsetMs: -2 * day,
    },
    {
      sender: 'AD-PNBSMS',
      body: 'Your A/c XX5501 is debited with INR 899.00 on 15-11-2026 via UPI to Myntra Designs Ref 632311223344.',
      offsetMs: -3 * day,
    },
    {
      sender: 'VM-ICICIB',
      body: 'Refund of Rs 120.00 credited to ICICI Acct XX7712 from Swiggy on 16-Nov-26 Ref 632388990011.',
      offsetMs: -2 * day + 2 * hour,
    },
    {
      sender: 'AD-HDFCBK',
      body: 'Alert: Transaction on HDFC A/C *4821 at Ola Cabs Ref 632358585858. Check statement.',
      offsetMs: -3 * hour,
    },
  ];

  const transactions: TransactionRecord[] = [];
  seedSms.forEach((item, idx) => {
    const parsed = parseBankSms({
      sender: item.sender,
      body: item.body,
      receivedAtMs: now + item.offsetMs,
    });
    if (parsed.status === 'parsed') {
      transactions.push({ ...parsed.transaction, id: `seed-${idx + 1}` });
    }
  });

  return {
    settings: {
      allowancePaise: 1200000, // ₹12,000
      allowanceDay: 1,
      fixedCommitmentsPaise: 300000, // ₹3,000 hostel/recharge
      onboardingCompleted: true,
      smsPermissionState: 'granted',
      onboardingVariant: 'A',
      referralCode: 'DU2026',
    },
    transactions,
    merchantOverrides: {},
    goal: {
      id: 'goal-1',
      name: 'College Fest & Headphones',
      targetPaise: 500000,
      targetDateIso: '2027-02-15',
      savedPaise: 200000,
    },
    events: [
      {
        id: 'ev-1',
        event: 'app_installed',
        variant: 'A',
        timestamp: now - 5 * day,
      },
      {
        id: 'ev-2',
        event: 'onboarding_completed',
        variant: 'A',
        timestamp: now - 5 * day + 120_000,
      },
      {
        id: 'ev-3',
        event: 'sms_permission_granted',
        variant: 'A',
        timestamp: now - 5 * day + 150_000,
      },
      {
        id: 'ev-4',
        event: 'first_transaction_tracked',
        variant: 'A',
        timestamp: now - 5 * day + 160_000,
      },
      {
        id: 'ev-5',
        event: 'app_open',
        variant: 'A',
        timestamp: now - 2 * day,
      },
    ],
    darkMode: false,
  };
}

function loadInitialState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return buildSeedState();
    return JSON.parse(raw) as PersistedState;
  } catch {
    return buildSeedState();
  }
}

const SIMULATED_INCOMING_ALERTS = [
  {
    sender: 'JD-AXISBK',
    body: 'INR 165.00 debited from A/c no. XX3310 on 18-11-26 at Zomato Online. UPI Ref 632391827999.',
  },
  {
    sender: 'AD-PAYTMB',
    body: 'Paid Rs.55.00 to Metro Rail DMRC using Paytm UPI. Ref 632300119988.',
  },
  {
    sender: 'JK-KOTAKB',
    body: 'INR 85.00 debited from Kotak AC X1145 to hostelcanteen@ybl Ref 632312129911.',
  },
  {
    sender: 'AD-PNBSMS',
    body: 'Rs.120.00 paid to Campus Stationery via UPI Ref 632356568877.',
  },
];

export default function App() {
  const [state, setState] = useState<PersistedState>(loadInitialState);
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [simIndex, setSimIndex] = useState(0);

  // Sync dark class cleanly on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (state.darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [state.darkMode]);

  // Persist locally (strictly on-device)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore quota errors
    }
  }, [state]);

  // Log app_open once per session load
  useEffect(() => {
    setState((prev) => ({
      ...prev,
      events: [
        ...prev.events,
        {
          id: `ev-${Date.now()}`,
          event: 'app_open',
          variant: prev.settings.onboardingVariant,
          timestamp: Date.now(),
        },
      ],
    }));
  }, []);

  const appendEvent = (
    events: AnalyticsEvent[],
    event: AnalyticsEventName,
    variant: 'A' | 'B',
    meta?: Record<string, string | number | boolean>
  ): AnalyticsEvent[] => [
    ...events,
    {
      id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      event,
      variant,
      timestamp: Date.now(),
      meta,
    },
  ];

  const snapshot = useMemo(
    () => calculateSafeToSpend(state.settings, state.transactions, state.goal),
    [state.settings, state.transactions, state.goal]
  );

  const handleOnboardingComplete = (updated: {
    allowancePaise: number;
    allowanceDay: number;
    fixedCommitmentsPaise: number;
    referralCode?: string;
    smsGranted: boolean;
    variant: 'A' | 'B';
  }) => {
    setState((prev) => {
      let nextEvents = appendEvent(prev.events, 'onboarding_completed', updated.variant);
      nextEvents = appendEvent(
        nextEvents,
        updated.smsGranted ? 'sms_permission_granted' : 'sms_permission_denied',
        updated.variant
      );
      if (updated.referralCode) {
        nextEvents = appendEvent(nextEvents, 'referral_code_entered', updated.variant, {
          hasCode: true,
        });
      }
      return {
        ...prev,
        settings: {
          ...prev.settings,
          allowancePaise: updated.allowancePaise,
          allowanceDay: updated.allowanceDay,
          fixedCommitmentsPaise: updated.fixedCommitmentsPaise,
          referralCode: updated.referralCode,
          onboardingVariant: updated.variant,
          onboardingCompleted: true,
          smsPermissionState: updated.smsGranted ? 'granted' : 'denied',
        },
        events: nextEvents,
      };
    });
    setShowOnboarding(false);
  };

  const handleAddManualExpense = (entry: {
    amountPaise: number;
    merchant: string;
    category: SpendCategory;
    direction: TransactionDirection;
    mode: PaymentMode;
  }) => {
    const merchantKey = normalizeMerchantKey(entry.merchant);
    const newTx: TransactionRecord = {
      id: `manual-${Date.now()}`,
      amountPaise: entry.amountPaise,
      direction: entry.direction,
      mode: entry.mode,
      merchant: entry.merchant,
      merchantKey,
      category: entry.category,
      categorySource: 'user',
      timestamp: Date.now(),
      needsReview: false,
      source: 'manual',
    };

    setState((prev) => {
      const hadZero = prev.transactions.length === 0;
      const nextEvents = hadZero
        ? appendEvent(prev.events, 'first_transaction_tracked', prev.settings.onboardingVariant)
        : prev.events;
      return {
        ...prev,
        transactions: [newTx, ...prev.transactions],
        events: nextEvents,
      };
    });
    setShowAddExpense(false);
  };

  const handleChangeCategory = (txId: string, newCategory: SpendCategory) => {
    setState((prev) => {
      const target = prev.transactions.find((t) => t.id === txId);
      if (!target) return prev;
      const mKey = target.merchantKey;

      const updatedTransactions = prev.transactions.map((t) =>
        t.id === txId || (mKey && t.merchantKey === mKey)
          ? { ...t, category: newCategory, categorySource: 'user' as const }
          : t
      );

      const nextOverrides = mKey
        ? { ...prev.merchantOverrides, [mKey]: newCategory }
        : prev.merchantOverrides;

      return {
        ...prev,
        transactions: updatedTransactions,
        merchantOverrides: nextOverrides,
        events: appendEvent(prev.events, 'category_changed', prev.settings.onboardingVariant, {
          category: newCategory,
        }),
      };
    });
  };

  const handleResolveReview = (
    txId: string,
    amountPaise: number,
    direction: TransactionDirection
  ) => {
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.map((t) =>
        t.id === txId ? { ...t, amountPaise, direction, needsReview: false } : t
      ),
    }));
  };

  const handleInjectSms = (
    sender: string,
    body: string
  ): { added: boolean; message: string } => {
    const parsed = parseBankSms(
      { sender, body, receivedAtMs: Date.now() },
      state.merchantOverrides
    );
    if (parsed.status === 'ignored') {
      return { added: false, message: `Ignored: ${parsed.reason}` };
    }
    if (isDuplicateTransaction(parsed.transaction, state.transactions)) {
      return { added: false, message: 'Duplicate alert detected and skipped.' };
    }

    const newTx: TransactionRecord = {
      ...parsed.transaction,
      id: `sms-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };

    setState((prev) => {
      let nextEvents = prev.events;
      if (prev.transactions.length === 0) {
        nextEvents = appendEvent(
          nextEvents,
          'first_transaction_tracked',
          prev.settings.onboardingVariant
        );
      }
      if (newTx.needsReview) {
        nextEvents = appendEvent(
          nextEvents,
          'parse_needs_review',
          prev.settings.onboardingVariant
        );
      }
      return {
        ...prev,
        transactions: [newTx, ...prev.transactions],
        events: nextEvents,
      };
    });

    return {
      added: true,
      message: newTx.needsReview
        ? 'Added to "Check these" review queue.'
        : `Tracked ${newTx.merchant} (${newTx.category}).`,
    };
  };

  const handleSimulateIncomingSms = () => {
    const item = SIMULATED_INCOMING_ALERTS[simIndex % SIMULATED_INCOMING_ALERTS.length];
    const uniqueRef = String(632390000000 + Date.now() % 999999);
    const bodyWithFreshRef = item.body.replace(/Ref\s+\d+/, `Ref ${uniqueRef}`);
    handleInjectSms(item.sender, bodyWithFreshRef);
    setSimIndex((i) => i + 1);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onDownloadZip={() => triggerZipDownload(ALL_ANDROID_REPO_FILES)}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {activeTab === 'dashboard' && (
          <DashboardView
            settings={state.settings}
            snapshot={snapshot}
            transactions={state.transactions}
            goal={state.goal}
            merchantOverrides={state.merchantOverrides}
            isDark={state.darkMode}
            onToggleTheme={() =>
              setState((prev) => ({ ...prev, darkMode: !prev.darkMode }))
            }
            onOpenAddExpense={() => setShowAddExpense(true)}
            onOpenOnboarding={() => setShowOnboarding(true)}
            onOpenGoalTab={() => setActiveTab('goal')}
            onOpenSmsLab={() => setActiveTab('sms-lab')}
            onChangeCategory={handleChangeCategory}
            onResolveReview={handleResolveReview}
            onGrantSmsLater={() => setShowOnboarding(true)}
            onSimulateIncomingSms={handleSimulateIncomingSms}
          />
        )}

        {activeTab === 'sms-lab' && (
          <SmsLabView
            existingTransactions={state.transactions}
            merchantOverrides={state.merchantOverrides}
            onInjectParsedSms={handleInjectSms}
          />
        )}

        {activeTab === 'goal' && (
          <GoalView
            goal={state.goal}
            onSaveGoal={(goal) => setState((prev) => ({ ...prev, goal }))}
            onContribute={(delta) =>
              setState((prev) =>
                prev.goal
                  ? {
                      ...prev,
                      goal: {
                        ...prev.goal,
                        savedPaise: prev.goal.savedPaise + delta,
                      },
                    }
                  : prev
              )
            }
            onClearGoal={() => setState((prev) => ({ ...prev, goal: null }))}
          />
        )}

        {activeTab === 'metrics' && (
          <PilotMetricsView events={state.events} settings={state.settings} />
        )}

        {activeTab === 'github' && (
          <GitHubRepoView
            onDownloadZip={() => triggerZipDownload(ALL_ANDROID_REPO_FILES)}
          />
        )}
      </main>

      {showOnboarding && (
        <OnboardingModal
          initialSettings={state.settings}
          onComplete={handleOnboardingComplete}
          onClose={() => setShowOnboarding(false)}
        />
      )}

      {showAddExpense && (
        <AddExpenseModal
          onAdd={handleAddManualExpense}
          onClose={() => setShowAddExpense(false)}
        />
      )}
    </div>
  );
}
