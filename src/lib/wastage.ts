/**
 * Wastage constants. Kept out of actions/wastage.ts because a "use server"
 * file may only export async functions.
 */

export type WastageReasonValue = "SPILLAGE" | "EVAPORATION" | "DAMAGED" | "TESTER";

export const WASTAGE_REASONS: WastageReasonValue[] = [
  "SPILLAGE",
  "EVAPORATION",
  "DAMAGED",
  "TESTER",
];

export const WASTAGE_LABELS: Record<WastageReasonValue, string> = {
  SPILLAGE: "Spillage / Accident",
  EVAPORATION: "Evaporation",
  DAMAGED: "Damaged / Broken Bottle",
  TESTER: "Tester / Promotional Sample",
};

export const WASTAGE_STYLES: Record<WastageReasonValue, string> = {
  SPILLAGE: "bg-amber-100 text-amber-700",
  EVAPORATION: "bg-sky-100 text-sky-700",
  DAMAGED: "bg-red-100 text-red-700",
  TESTER: "bg-violet-100 text-violet-700",
};

export const wastageLabel = (value: string): string =>
  WASTAGE_LABELS[value as WastageReasonValue] ?? value;
