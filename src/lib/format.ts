/**
 * Burmese Kyat formatting.
 *
 * Kyat has no subunit in everyday retail use, so whole amounts print without
 * decimals (10,000 Ks). Fractional values below 1,000 — cost per ml, mostly —
 * keep 2 decimals so unit costing stays readable.
 */

const CURRENCY_SUFFIX = process.env.NEXT_PUBLIC_CURRENCY_SUFFIX ?? "Ks";
const LOCALE = process.env.NEXT_PUBLIC_LOCALE ?? "en-US";

export function formatCurrency(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  const fractionDigits = Number.isInteger(safe) ? 0 : Math.abs(safe) < 1000 ? 2 : 0;

  const amount = new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(safe);

  return `${amount} ${CURRENCY_SUFFIX}`;
}

/** Bare number, no currency suffix — for tight table cells and CSV. */
export function formatAmount(value: number, fractionDigits = 0): string {
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Number.isFinite(value) ? value : 0);
}

/** Trims trailing zeros so 10 -> "10ml" but 7.5 -> "7.5ml". */
export function formatMl(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded}ml`;
}

export function formatPercent(value: number, fractionDigits = 0): string {
  return `${(Number.isFinite(value) ? value : 0).toFixed(fractionDigits)}%`;
}
