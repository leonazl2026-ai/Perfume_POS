/**
 * One-off retroactive loyalty backfill.
 *
 *   npm run loyalty:backfill            # apply
 *   npm run loyalty:backfill -- --dry   # report only, change nothing
 *   npm run loyalty:backfill -- --since=2026-01-01
 *
 * Grants points for past COMPLETED sales that have a customer attached and no
 * loyalty entry yet. Idempotent: re-running skips sales already awarded, so a
 * partial run can safely be resumed.
 */

import { PrismaClient } from "@prisma/client";
// lib/loyalty imports only *types* from Prisma and the settings module, so it
// carries no runtime path-alias — safe to load from a plain tsx script.
import { calculatePointsEarned, recalculateLoyaltyPoints } from "../src/lib/loyalty";

const prisma = new PrismaClient();

/** Mirrors DEFAULT_SETTINGS in src/lib/settings.ts. */
const LOYALTY_DEFAULTS = {
  loyaltyEnabled: true,
  earnRateAmount: 1000,
  pointsEarnedPerRate: 1,
  redeemPointValue: 10,
};

/**
 * Reads the loyalty settings directly rather than importing getSettings(),
 * which pulls the "@/" alias chain that a bare tsx run may not resolve.
 */
async function readLoyaltyConfig() {
  const rows = await prisma.setting.findMany();
  const stored = new Map(rows.map((row) => [row.key, row.value]));

  const number = (key: keyof typeof LOYALTY_DEFAULTS, fallback: number): number => {
    const parsed = Number.parseFloat(stored.get(key) ?? "");
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  };

  const rawEnabled = stored.get("loyaltyEnabled");

  return {
    enabled:
      rawEnabled === undefined
        ? LOYALTY_DEFAULTS.loyaltyEnabled
        : rawEnabled === "1" || rawEnabled.toLowerCase() === "true",
    earnRateAmount: number("earnRateAmount", LOYALTY_DEFAULTS.earnRateAmount),
    pointsEarnedPerRate: number("pointsEarnedPerRate", LOYALTY_DEFAULTS.pointsEarnedPerRate),
    redeemPointValue: number("redeemPointValue", LOYALTY_DEFAULTS.redeemPointValue),
  };
}

interface Options {
  dryRun: boolean;
  since: Date | null;
}

function parseArgs(argv: string[]): Options {
  const dryRun = argv.includes("--dry") || argv.includes("--dry-run");

  const sinceArg = argv.find((arg) => arg.startsWith("--since="));
  let since: Date | null = null;

  if (sinceArg) {
    const parsed = new Date(sinceArg.split("=")[1]);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`Invalid --since date: ${sinceArg.split("=")[1]}`);
    }
    since = parsed;
  }

  return { dryRun, since };
}

const money = (value: number): string => `${value.toLocaleString("en-US")} Ks`;

async function main() {
  const options = parseArgs(process.argv.slice(2));

  const config = await readLoyaltyConfig();

  console.log("─".repeat(64));
  console.log("Retroactive loyalty backfill");
  console.log("─".repeat(64));
  console.log(
    `Rate      : ${config.pointsEarnedPerRate} point(s) per ${money(config.earnRateAmount)}`
  );
  console.log(`Redeem    : 1 point = ${money(config.redeemPointValue)}`);
  console.log(`Since     : ${options.since ? options.since.toISOString() : "all time"}`);
  console.log(`Mode      : ${options.dryRun ? "DRY RUN (no writes)" : "APPLY"}`);

  if (!config.enabled) {
    // The rates are still readable, so a disabled system is a warning rather
    // than a hard stop — the admin may be backfilling before switching on.
    console.log("\n⚠  Loyalty is currently DISABLED in settings. Points will still be");
    console.log("   granted using the configured rates; enable it to let staff redeem.");
  }

  if (config.earnRateAmount <= 0 || config.pointsEarnedPerRate <= 0) {
    console.error("\n✗ Earn rate is zero or negative — nothing can be granted. Aborting.");
    process.exitCode = 1;
    return;
  }

  const sales = await prisma.sale.findMany({
    where: {
      status: "COMPLETED",
      customerId: { not: null },
      ...(options.since ? { saleDate: { gte: options.since } } : {}),
      // Skip anything already awarded — this is what makes re-runs safe.
      loyaltyLogs: { none: { type: "EARNED" } },
    },
    orderBy: { saleDate: "asc" },
    select: {
      id: true,
      saleNumber: true,
      saleDate: true,
      customerId: true,
      subtotal: true,
      discount: true,
      loyaltyDiscount: true,
    },
  });

  console.log(`\nFound ${sales.length} sale(s) awaiting points.\n`);

  if (sales.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  const touchedCustomers = new Set<string>();
  let granted = 0;
  let skippedZero = 0;

  for (const sale of sales) {
    if (!sale.customerId) continue;

    // Same base as live checkout: merchandise value less both discounts.
    const eligible =
      Number(sale.subtotal) - Number(sale.discount) - Number(sale.loyaltyDiscount);
    const points = calculatePointsEarned(eligible, { ...config, enabled: true });

    if (points <= 0) {
      skippedZero += 1;
      continue;
    }

    const date = sale.saleDate.toISOString().slice(0, 10);
    console.log(
      `  ${sale.saleNumber.padEnd(20)} ${date}  ${money(eligible).padStart(14)}  → ${points} pt(s)`
    );

    if (!options.dryRun) {
      await prisma.$transaction(async (tx) => {
        await tx.loyaltyLog.create({
          data: {
            customerId: sale.customerId!,
            saleId: sale.id,
            type: "EARNED",
            points,
            description: `Backfilled from ${sale.saleNumber}`,
          },
        });

        await tx.sale.update({
          where: { id: sale.id },
          data: { pointsEarned: points },
        });
      });
    }

    granted += points;
    touchedCustomers.add(sale.customerId);
  }

  // Balances are caches of the ledger, so rebuild them once per customer
  // rather than incrementing as we go.
  if (!options.dryRun && touchedCustomers.size > 0) {
    console.log(`\nRebuilding balances for ${touchedCustomers.size} customer(s)…`);
    for (const customerId of touchedCustomers) {
      await recalculateLoyaltyPoints(prisma, customerId);
    }
  }

  console.log("\n" + "─".repeat(64));
  console.log(`Sales processed   : ${sales.length}`);
  console.log(`Sales skipped (0) : ${skippedZero}`);
  console.log(`Customers updated : ${touchedCustomers.size}`);
  console.log(`Points granted    : ${granted}`);
  console.log(
    options.dryRun
      ? "DRY RUN — nothing was written. Re-run without --dry to apply."
      : "Done."
  );
  console.log("─".repeat(64));
}

main()
  .catch((error) => {
    console.error("\n✗ Backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
