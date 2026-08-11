import { parseDateRange } from "@/lib/dateRange";
import { formatCurrency, formatMl } from "@/lib/format";
import { wastageLabel, WASTAGE_STYLES, type WastageReasonValue } from "@/lib/wastage";
import { getWastageLogs, getWastageTotals } from "@/lib/reportQueries";
import { DateRangeFilter } from "@/components/admin/FilterBar";
import { ExportButton } from "@/components/admin/ExportButton";
import { WastageTable } from "@/components/admin/WastageTable";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function AdminWastagePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const range = parseDateRange(params);

  const [logs, totals] = await Promise.all([getWastageLogs(range), getWastageTotals(range)]);

  // Totals already exclude voided entries.
  const grandTotal = totals.reduce((sum, t) => sum + t.lossValue, 0);
  const totalMl = totals.reduce((sum, t) => sum + t.mlDeducted, 0);

  return (
    <div>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Wastage Log</h1>
          <p className="text-sm text-gray-500">
            {range.label} · {formatCurrency(grandTotal)} written off · {formatMl(totalMl)} lost
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportButton endpoint="/api/export/wastage" />
          <DateRangeFilter preset={range.preset} />
        </div>
      </header>

      <p className="mb-4 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500">
        Every write-off here is mirrored into Expenses under &ldquo;Loss &amp; Damaged&rdquo;, so
        these amounts are already deducted from net profit. Do not record them again by hand.
        Reverting an entry restores the stock and removes its expense.
      </p>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {totals.length === 0 ? (
          <p className="col-span-full rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-400">
            No losses recorded in this period.
          </p>
        ) : (
          totals.map((total) => (
            <div key={total.reason} className="rounded-xl border border-gray-200 bg-white p-3">
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  WASTAGE_STYLES[total.reason as WastageReasonValue] ??
                  "bg-gray-100 text-gray-600"
                }`}
              >
                {wastageLabel(total.reason)}
              </span>
              <p className="mt-1.5 text-lg font-semibold text-red-600">
                {formatCurrency(total.lossValue)}
              </p>
              <p className="text-[11px] text-gray-400">
                {total.count} event{total.count === 1 ? "" : "s"} · {formatMl(total.mlDeducted)}
              </p>
            </div>
          ))
        )}
      </div>

      <WastageTable logs={logs} />
    </div>
  );
}
