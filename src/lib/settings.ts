import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { TierThresholds } from "@/lib/tiers";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Tunable thresholds, persisted in the Setting key/value table.
 * Anything missing falls back to the defaults below, so a fresh database
 * works without seeding settings first.
 */

export interface AppSettings {
  /** Warn when sealed bottles fall to or below this. */
  lowStockBottles: number;
  /** Warn when active decant volume falls to or below this (ml). */
  lowStockMl: number;
  tierRegularSpend: number;
  tierRegularOrders: number;
  tierVipSpend: number;
  tierVipOrders: number;
  /** Days of no sales before a batch counts as slow-moving. */
  slowMovingDays: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  lowStockBottles: 2,
  lowStockMl: 15,
  tierRegularSpend: 150_000,
  tierRegularOrders: 3,
  tierVipSpend: 500_000,
  tierVipOrders: 10,
  slowMovingDays: 60,
};

const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[];

/**
 * Pass the transaction client when reading inside a transaction — issuing the
 * query on a second connection would contend with SQLite's write lock.
 */
export async function getSettings(db: Db = prisma): Promise<AppSettings> {
  const rows = await db.setting.findMany();
  const stored = new Map(rows.map((row) => [row.key, row.value]));

  const settings = { ...DEFAULT_SETTINGS };
  for (const key of SETTING_KEYS) {
    const raw = stored.get(key);
    if (raw === undefined) continue;

    const parsed = Number.parseFloat(raw);
    // Ignore corrupt values rather than propagating NaN into queries.
    if (Number.isFinite(parsed) && parsed >= 0) settings[key] = parsed;
  }

  return settings;
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<void> {
  const entries = Object.entries(patch).filter(
    ([key, value]) =>
      SETTING_KEYS.includes(key as keyof AppSettings) &&
      typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0
  );

  for (const [key, value] of entries) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value: String(value) },
      update: { value: String(value) },
    });
  }
}

export function tierThresholds(settings: AppSettings): TierThresholds {
  return {
    regularSpend: settings.tierRegularSpend,
    regularOrders: settings.tierRegularOrders,
    vipSpend: settings.tierVipSpend,
    vipOrders: settings.tierVipOrders,
  };
}

/** Expense category that wastage write-offs are booked against. */
export const WASTAGE_CATEGORY_NAME = "Loss & Damaged";
