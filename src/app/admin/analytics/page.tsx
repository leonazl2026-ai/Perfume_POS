import { parseDateRange } from "@/lib/dateRange";
import {
  getBestSellers,
  getChannelPerformance,
  getPaymentBreakdown,
  getPaymentByChannel,
  getSlowMovingStock,
} from "@/lib/analytics";
import { getSettings } from "@/lib/settings";
import { DateRangeFilter } from "@/components/admin/FilterBar";
import {
  ChannelPanel,
  PaymentByChannelPanel,
  PaymentPanel,
  RankingPanel,
  SizeMixPanel,
  SlowMovingPanel,
} from "@/components/admin/AnalyticsPanels";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const SLOW_WINDOWS = [30, 60, 90];

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const range = parseDateRange(params);
  const settings = await getSettings();

  const slowDaysParam = Number.parseInt(
    typeof params.slowDays === "string" ? params.slowDays : "",
    10
  );
  const slowDays = SLOW_WINDOWS.includes(slowDaysParam)
    ? slowDaysParam
    : settings.slowMovingDays;

  const [channels, payments, paymentsByChannel, bestSellers, slowMoving] = await Promise.all([
    getChannelPerformance(range),
    getPaymentBreakdown(range),
    getPaymentByChannel(range),
    getBestSellers(range),
    getSlowMovingStock(slowDays),
  ]);

  return (
    <div>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500">{range.label}</p>
        </div>
        <DateRangeFilter preset={range.preset} />
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <ChannelPanel rows={channels} />
        <PaymentPanel rows={payments} />
        <SizeMixPanel rows={bestSellers.bySize} />

        <RankingPanel
          title="Best sellers — by perfume"
          subtitle="Ranked by units sold"
          rows={bestSellers.byProduct}
          metric="quantity"
        />
        <RankingPanel
          title="Best sellers — by brand"
          subtitle="Ranked by revenue"
          rows={bestSellers.byBrand}
          metric="revenue"
        />
        <RankingPanel
          title="Most profitable products"
          subtitle="Ranked by net profit generated"
          rows={bestSellers.mostProfitable}
          metric="profit"
        />

        <div className="lg:col-span-2">
          <SlowMovingPanel rows={slowMoving} days={slowDays} />
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
            <span>Window:</span>
            {SLOW_WINDOWS.map((days) => {
              const query = new URLSearchParams(
                Object.entries(params).flatMap(([key, value]) =>
                  typeof value === "string" ? [[key, value] as [string, string]] : []
                )
              );
              query.set("slowDays", String(days));

              return (
                <a
                  key={days}
                  href={`/admin/analytics?${query.toString()}`}
                  className={`rounded-md px-2 py-1 font-medium transition ${
                    slowDays === days
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {days}d
                </a>
              );
            })}
          </div>
        </div>

        <PaymentByChannelPanel rows={paymentsByChannel} />
      </div>
    </div>
  );
}
