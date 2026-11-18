/**
 * Formats integer paise into Indian Rupee notation with Indian digit grouping (e.g., ₹1,23,456).
 * Never uses floating-point arithmetic for storage; only converts at final display step.
 */
export function formatInr(paise: number, options?: { showSign?: boolean; forceDecimals?: boolean }): string {
  const isNegative = paise < 0;
  const absPaise = Math.abs(Math.round(paise));
  const rupees = Math.floor(absPaise / 100);
  const remPaise = absPaise % 100;

  const groupedRupees = rupees.toLocaleString('en-IN');
  const decimalPart =
    remPaise > 0 || options?.forceDecimals ? `.${String(remPaise).padStart(2, '0')}` : '';

  const prefix = isNegative ? '-₹' : options?.showSign && paise > 0 ? '+₹' : '₹';
  return `${prefix}${groupedRupees}${decimalPart}`;
}

export function formatKolkataDate(timestampMs: number): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(timestampMs));
}

export function getKolkataDateParts(timestampMs: number): {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
} {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(timestampMs));

  const year = Number(parts.find((p) => p.type === 'year')?.value ?? 2026);
  const month = Number(parts.find((p) => p.type === 'month')?.value ?? 1);
  const day = Number(parts.find((p) => p.type === 'day')?.value ?? 1);
  return { year, month, day };
}

export function kolkataMidnightUtcMs(year: number, month: number, day: number): number {
  // Asia/Kolkata is fixed at UTC+05:30 (no DST)
  return Date.UTC(year, month - 1, day, 0, 0, 0, 0) - 5.5 * 60 * 60 * 1000;
}

export function isValidReferralCode(code: string): boolean {
  const trimmed = code.trim();
  if (trimmed.length === 0) return true; // optional
  return /^[A-Za-z0-9]{4,8}$/.test(trimmed);
}
