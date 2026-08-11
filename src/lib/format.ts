const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY ?? "USD";
const LOCALE = process.env.NEXT_PUBLIC_LOCALE ?? "en-US";

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: CURRENCY,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Trims trailing zeros so 10 -> "10ml" but 7.5 -> "7.5ml". */
export function formatMl(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded}ml`;
}
