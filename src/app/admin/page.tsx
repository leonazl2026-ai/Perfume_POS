import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatMl } from "@/lib/format";
import { parseDateRange } from "@/lib/dateRange";
import {
  getExpenseTotalsByCategory,
  getFinancialSummary,
  getSales,
} from "@/lib/reportQueries";
import { getBestSellers, getChannelPerformance } from "@/lib/analytics";
import { getSettings } from "@/lib/settings";
import { ChannelPanel, RankingPanel } from "@/components/admin/AnalyticsPanels";
import { DELIVERY_LABELS } from "@/lib/delivery";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const today = parseDateRange({ preset: "today" });
  const month = parseDateRange({ preset: "month" });

  // Thresholds are admin-configurable under Settings.
  const settings = await getSettings();

  const [
    todaySummary,
    monthSummary,
    expenseTotals,
    recentSales,
    lowStock,
    pendingCount,
    channels,
    bestSellers,
  ] = await Promise.all([
    getFinancialSummary(today),
    getFinancialSummary(month),
    getExpenseTotalsByCategory(month),
    getSales({ range: today }),
    prisma.productVariant.findMany({
      where: {
        isActive: true,
        OR: [
          { unopenedBottles: { lte: settings.lowStockBottles } },
          { decantActiveRemainingMl: { lte: settings.lowStockMl } },
        ],
      },
      include: { product: true },
      orderBy: { decantActiveRemainingMl: "asc" },
      take: 6,
    }),
    prisma.sale.count({
      where: { status: "COMPLETED", deliveryStatus: { in: ["PENDING", "PACKED"] } },
    }),
    getChannelPerformance(month),
    getBestSellers(month),
  ]);

  const topExpenses = expenseTotals.filter((e) => e.total > 0).slice(0, 5);

  return (
    <div>
      <header className="mb-5">
        <h1 className="text-lg font-semibold text-gray-900">Overview</h1>
        <p className="text-sm text-gray-500">Today at a glance, with this month&apos;s P&amp;L.</p>
      </header>

      {/* Today */}
      <section className="mb-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Today
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Revenue" value={formatCurrency(todaySummary.revenue)} />
          <Stat label="Sales" value={String(todaySummary.saleCount)} />
          <Stat
            label="Gross profit"
            value={formatCurrency(todaySummary.grossProfit)}
            tone="positive"
          />
          <Stat label="Awaiting fulfilment" value={String(pendingCount)} href="/admin/sales" />
        </div>
      </section>

      {/* Month */}
      <section className="mb-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          This month
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat label="Revenue" value={formatCurrency(monthSummary.revenue)} />
          <Stat label="Cost of goods" value={formatCurrency(monthSummary.cogs)} muted />
          <Stat
            label="Gross profit"
            value={formatCurrency(monthSummary.grossProfit)}
            tone="positive"
          />
          <Stat label="Expenses" value={formatCurrency(monthSummary.expenses)} muted />
          <Stat
            label="Net profit"
            value={formatCurrency(monthSummary.netProfit)}
            tone={monthSummary.netProfit >= 0 ? "positive" : "negative"}
            emphasis
            href="/admin/sales"
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Today's sales */}
        <section className="rounded-xl border border-gray-200 bg-white p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Today&apos;s sales</h2>
            <Link href="/admin/sales" className="text-xs font-medium text-gray-500 hover:text-gray-900">
              View all →
            </Link>
          </div>

          {recentSales.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No sales yet today.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {recentSales.slice(0, 8).map((sale) => (
                <li key={sale.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs text-gray-900">{sale.saleNumber}</p>
                    <p className="truncate text-[11px] text-gray-400">
                      {sale.customerName ?? "Walk-in"} · {DELIVERY_LABELS[sale.deliveryStatus]}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrency(sale.total)}
                    </p>
                    <p className="text-[11px] text-emerald-600">
                      +{formatCurrency(sale.totalProfit)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-4">
          {/* Low stock */}
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Running low</h2>
              <Link
                href="/admin/products"
                className="text-xs font-medium text-gray-500 hover:text-gray-900"
              >
                Manage →
              </Link>
            </div>

            <p className="mb-2 text-[11px] text-gray-400">
              Alerts at ≤ {settings.lowStockBottles} sealed or ≤ {settings.lowStockMl}ml active
            </p>

            {lowStock.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">Nothing is running low.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {lowStock.map((v) => (
                  <li key={v.id} className="py-2">
                    <p className="truncate text-sm text-gray-900">{v.product.name}</p>
                    <p className="truncate text-[11px] text-gray-400">
                      <span
                        className={
                          v.unopenedBottles <= settings.lowStockBottles ? "text-red-500" : ""
                        }
                      >
                        {v.unopenedBottles} sealed
                      </span>
                      {" · "}
                      <span
                        className={
                          v.decantActiveRemainingMl <= settings.lowStockMl ? "text-red-500" : ""
                        }
                      >
                        {formatMl(v.decantActiveRemainingMl)} active
                      </span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Expenses */}
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Top expenses</h2>
              <Link
                href="/admin/expenses"
                className="text-xs font-medium text-gray-500 hover:text-gray-900"
              >
                Record →
              </Link>
            </div>

            {topExpenses.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">
                No expenses this month.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {topExpenses.map((row) => (
                  <li
                    key={row.categoryId}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="truncate text-gray-600">{row.categoryName}</span>
                    <span className="shrink-0 font-medium text-gray-900">
                      {formatCurrency(row.total)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {/* Month-to-date insights */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChannelPanel rows={channels} />
        <RankingPanel
          title="Best sellers this month"
          subtitle="Ranked by units sold"
          rows={bestSellers.byProduct}
          metric="quantity"
          limit={6}
        />
        <RankingPanel
          title="Most profitable this month"
          subtitle="Ranked by net profit"
          rows={bestSellers.mostProfitable}
          metric="profit"
          limit={6}
        />
      </div>

      <p className="mt-3 text-xs text-gray-400">
        Full breakdowns — brand rankings, decant size mix, dead stock, payment by channel — under{" "}
        <Link href="/admin/analytics" className="font-medium text-gray-600 hover:text-gray-900">
          Analytics
        </Link>
        .
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
  muted = false,
  emphasis = false,
  href,
}: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "negative";
  muted?: boolean;
  emphasis?: boolean;
  href?: string;
}) {
  const valueColor =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "negative"
        ? "text-red-600"
        : "text-gray-900";

  const body = (
    <>
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${muted ? "text-gray-500" : valueColor}`}>
        {value}
      </p>
    </>
  );

  const className = `block rounded-xl border bg-white p-3 ${
    emphasis ? "border-gray-900" : "border-gray-200"
  } ${href ? "transition hover:border-gray-900" : ""}`;

  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
