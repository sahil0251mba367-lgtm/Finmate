export type TransactionDirection = 'DEBIT' | 'CREDIT' | 'REFUND';

export type PaymentMode = 'UPI' | 'DEBIT_CARD' | 'ATM' | 'OTHER';

export type SpendCategory = 'Food' | 'Travel' | 'Shopping' | 'Academics' | 'Others';

export type CategorySource = 'auto' | 'user';

export interface TransactionRecord {
  id: string;
  amountPaise: number;
  direction: TransactionDirection;
  mode: PaymentMode;
  merchant: string;
  merchantKey: string;
  category: SpendCategory;
  categorySource: CategorySource;
  timestamp: number;
  upiRef?: string;
  accountLast4?: string;
  needsReview: boolean;
  source: 'sms' | 'manual';
}

export interface UserSettings {
  allowancePaise: number;
  allowanceDay: number;
  fixedCommitmentsPaise: number;
  onboardingCompleted: boolean;
  smsPermissionState: 'unset' | 'granted' | 'denied';
  onboardingVariant: 'A' | 'B';
  referralCode?: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetPaise: number;
  targetDateIso: string; // YYYY-MM-DD in Asia/Kolkata
  savedPaise: number;
}

export type AnalyticsEventName =
  | 'app_installed'
  | 'onboarding_completed'
  | 'sms_permission_granted'
  | 'sms_permission_denied'
  | 'first_transaction_tracked'
  | 'app_open'
  | 'referral_code_entered'
  | 'category_changed'
  | 'parse_needs_review';

export interface AnalyticsEvent {
  id: string;
  event: AnalyticsEventName;
  timestamp: number;
  variant: 'A' | 'B';
  meta?: Record<string, string | number | boolean>;
}
