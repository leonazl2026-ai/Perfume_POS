import { formatCurrency, formatMl, formatPercent } from "@/lib/format";
import { CHANNEL_LABELS, CHANNEL_STYLES, CHANNEL_SHORT } from "@/lib/channels";
import { paymentLabel } from "@/lib/paymentMethods";
import type {
  BestSellerReport,
  ChannelPerformanceRow,
  PaymentBreakdownRow,
  ProductPerformanceRow,
  SlowMovingRow,
} from "@/lib/analytics";
import type { OrderChannelValue } from "@/lib/channels";

/**
 * Server components — pure presentation over the analytics rollups.
 * Bars are plain divs rather than a chart library, so nothing ships to the
 * client for what is essentially a ranked table.
 */

export function Card({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-gray-200 bg-white p-4 ${className}`}>
      <header className="mb-3">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="text-[11px] text-gray-400">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

function Empty({ message }: { message: string }) {
  return <p className="py-8 text-center text-sm text-gray-400">{message}</p>;
}

function Bar({ share, tone = "bg-gray-900" }: { share: number; tone?: string }) {
  return (
    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
      <div className={`h-full ${tone}`} style={{ width: `${Math.min(100, share)}%` }} />
    </div>
  );
}

// ─── Channel ─────────────────────────────────────────────────────────

export function ChannelPanel({ rows }: { rows: ChannelPerformanceRow[] }) {
  const max = Math.max(...rows.map((r) => r.revenue), 1);

  return (
    <Card title="Sales by order channel" subtitle="Revenue and volume per source">
      {rows.length === 0 ? (
        <Empty message="No sales in this period." />
      ) : (
        <ul className="space-y-2.5">
          {rows.map((row) => (
            <li key={row.channel}>
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CHANNEL_STYLES[row.channel]}`}
                >
                  {CHANNEL_LABELS[row.channel]}
                </span>
                <span className="text-sm font-medium text-gray-900">
                  {formatCurrency(row.revenue)}
                </span>
              </div>
              <Bar share={(row.revenue / max) * 100} />
              <p className="mt-0.5 text-[11px] text-gray-400">
                {row.orderCount} order{row.orderCount === 1 ? "" : "s"} · avg{" "}
                {formatCurrency(row.averageOrderValue)} · profit {formatCurrency(row.profit)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ─── Payment ─────────────────────────────────────────────────────────

export function PaymentPanel({ rows }: { rows: PaymentBreakdownRow[] }) {
  return (
    <Card title="Payment method breakdown" subtitle="Revenue collected per method">
      {rows.length === 0 ? (
        <Empty message="No payments in this period." />
      ) : (
        <ul className="space-y-2.5">
          {rows.map((row) => (
            <li key={row.method}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate text-gray-700">{paymentLabel(row.method)}</span>
                <span className="shrink-0 font-medium text-gray-900">
                  {formatCurrency(row.revenue)}
                </span>
              </div>
              <Bar share={row.share} tone="bg-emerald-500" />
              <p className="mt-0.5 text-[11px] text-gray-400">
                {row.orderCount} order{row.orderCount === 1 ? "" : "s"} ·{" "}
                {formatPercent(row.share)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function PaymentByChannelPanel({
  rows,
}: {
  rows: { channel: OrderChannelValue; methods: PaymentBreakdownRow[] }[];
}) {
  return (
    <Card title="Payment method by channel" subtitle="How each channel pays">
      {rows.length === 0 ? (
        <Empty message="No sales in this period." />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.channel}>
              <p className="mb-1 text-xs font-medium text-gray-700">
                {CHANNEL_SHORT[row.channel]}
              </p>
              <ul className="space-y-1">
                {row.methods.map((method) => (
                  <li
                    key={method.method}
                    className="flex items-baseline justify-between gap-2 text-[11px]"
                  >
                    <span className="truncate text-gray-500">{paymentLabel(method.method)}</span>
                    <span className="shrink-0 text-gray-900">
                      {formatCurrency(method.revenue)}{" "}
                      <span className="text-gray-400">({formatPercent(method.share)})</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── Rankings ────────────────────────────────────────────────────────

export function RankingPanel({
  title,
  subtitle,
  rows,
  metric,
  limit = 8,
}: {
  title: string;
  subtitle?: string;
  rows: ProductPerformanceRow[];
  /** Which figure drives the bar and the right-hand number. */
  metric: "quantity" | "revenue" | "profit";
  limit?: number;
}) {
  const visible = rows.slice(0, limit);
  const max = Math.max(...visible.map((r) => r[metric]), 1);

  const tone =
    metric === "profit" ? "bg-emerald-500" : metric === "revenue" ? "bg-gray-900" : "bg-blue-500";

  return (
    <Card title={title} subtitle={subtitle}>
      {visible.length === 0 ? (
        <Empty message="No sales in this period." />
      ) : (
        <ol className="space-y-2.5">
          {visible.map((row, index) => (
            <li key={row.key}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-sm text-gray-900">
                  <span className="mr-1.5 text-[11px] text-gray-400">{index + 1}.</span>
                  {row.label}
                </span>
                <span className="shrink-0 text-sm font-medium text-gray-900">
                  {metric === "quantity"
                    ? `${row.quantity} sold`
                    : formatCurrency(row[metric])}
                </span>
              </div>
              <Bar share={(row[metric] / max) * 100} tone={tone} />
              <p className="mt-0.5 text-[11px] text-gray-400">
                {row.sublabel} · {row.quantity} sold · {formatCurrency(row.revenue)} revenue ·{" "}
                {formatCurrency(row.profit)} profit ({formatPercent(row.margin)})
              </p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export function SizeMixPanel({ rows }: { rows: BestSellerReport["bySize"] }) {
  const totalQuantity = rows.reduce((sum, r) => sum + r.quantity, 0);

  return (
    <Card title="Sales by decant size" subtitle="Where the volume actually goes">
      {rows.length === 0 ? (
        <Empty message="No sales in this period." />
      ) : (
        <ul className="space-y-2.5">
          {rows.map((row) => {
            const share = totalQuantity > 0 ? (row.quantity / totalQuantity) * 100 : 0;
            return (
              <li key={row.key}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="text-gray-700">{row.label}</span>
                  <span className="font-medium text-gray-900">{row.quantity} sold</span>
                </div>
                <Bar share={share} tone="bg-violet-500" />
                <p className="mt-0.5 text-[11px] text-gray-400">
                  {formatPercent(share)} of units · {formatCurrency(row.revenue)} revenue ·{" "}
                  {formatCurrency(row.profit)} profit
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// ─── Dead stock ──────────────────────────────────────────────────────

export function SlowMovingPanel({ rows, days }: { rows: SlowMovingRow[]; days: number }) {
  const tiedUp = rows.reduce((sum, r) => sum + r.stockValue, 0);

  return (
    <Card
      title="Slow-moving / dead stock"
      subtitle={`No sales in the last ${days} days · ${formatCurrency(tiedUp)} tied up`}
    >
      {rows.length === 0 ? (
        <Empty message="Everything is moving. Nothing flagged." />
      ) : (
        <ul className="divide-y divide-gray-100">
          {rows.slice(0, 12).map((row) => (
            <li key={row.variantId} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm text-gray-900">{row.productName}</p>
                <p className="truncate font-mono text-[11px] text-gray-400">
                  {row.variantBatchId} · {row.unopenedBottles} sealed ·{" "}
                  {formatMl(row.decantActiveRemainingMl)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-medium text-gray-900">
                  {formatCurrency(row.stockValue)}
                </p>
                <p className="text-[11px] text-gray-400">
                  {row.daysSinceLastSale === null
                    ? "Never sold"
                    : `${row.daysSinceLastSale}d since sale`}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
