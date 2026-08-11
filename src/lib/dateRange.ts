export type RangePreset = "today" | "7d" | "30d" | "month" | "all" | "custom";

export interface DateRange {
  preset: RangePreset;
  from: Date | null;
  to: Date | null;
  label: string;
}

export const RANGE_PRESETS: { id: RangePreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "month", label: "This month" },
  { id: "all", label: "All time" },
];

const startOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

/** Accepts a single search-param value that may arrive as an array. */
const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const parseDate = (value: string | undefined): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * Resolves `?preset=` / `?from=&to=` into a concrete range.
 * Explicit from/to always wins over a preset.
 */
export function parseDateRange(searchParams: {
  [key: string]: string | string[] | undefined;
}): DateRange {
  const customFrom = parseDate(first(searchParams.from));
  const customTo = parseDate(first(searchParams.to));

  if (customFrom || customTo) {
    return {
      preset: "custom",
      from: customFrom ? startOfDay(customFrom) : null,
      to: customTo ? endOfDay(customTo) : null,
      label: "Custom range",
    };
  }

  const preset = (first(searchParams.preset) ?? "30d") as RangePreset;
  const now = new Date();

  switch (preset) {
    case "today":
      return { preset, from: startOfDay(now), to: endOfDay(now), label: "Today" };

    case "7d": {
      const from = startOfDay(new Date(now));
      from.setDate(from.getDate() - 6);
      return { preset, from, to: endOfDay(now), label: "Last 7 days" };
    }

    case "month": {
      const from = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
      return { preset, from, to: endOfDay(now), label: "This month" };
    }

    case "all":
      return { preset, from: null, to: null, label: "All time" };

    case "30d":
    default: {
      const from = startOfDay(new Date(now));
      from.setDate(from.getDate() - 29);
      return { preset: "30d", from, to: endOfDay(now), label: "Last 30 days" };
    }
  }
}

/** Prisma date filter, or undefined when the range is unbounded. */
export function toDateFilter(range: DateRange): { gte?: Date; lte?: Date } | undefined {
  if (!range.from && !range.to) return undefined;
  return {
    ...(range.from ? { gte: range.from } : {}),
    ...(range.to ? { lte: range.to } : {}),
  };
}

export const formatDate = (date: Date): string =>
  new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(
    date
  );

export const formatDateTime = (date: Date): string =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

/** yyyy-mm-dd for <input type="date"> values. */
export const toDateInputValue = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
