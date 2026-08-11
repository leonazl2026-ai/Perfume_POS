import { parseDateRange, formatDateTime } from "@/lib/dateRange";
import { formatCurrency, formatMl } from "@/lib/format";
import { wastageLabel, WASTAGE_STYLES, type WastageReasonValue } from "@/lib/wastage";
import { getWastageLogs, getWastageTotals } from "@/lib/reportQueries";
import { DateRangeFilter } from "@/components/admin/FilterBar";
import { ExportButton } from "@/components/admin/ExportButton";

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

  const grandTotal = totals.reduce((sum, t) => sum + t.lossValue, 0);
  const totalMl = totals.reduce((sum, t) => sum + t.mlDeducted, 0);

  return (
    <div>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Wastage Log</h1>
          <p className="text-sm text-gray-500">
            {range.label} · {formatCurrency(grandTotal)} written off ·{" "}
            {formatMl(totalMl)} lost
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
      </p>

      {/* Totals by reason */}
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
                  WASTAGE_STYLES[total.reason as WastageReasonValue] ?? "bg-gray-100 text-gray-600"
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

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[46rem] text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">Product / Batch</th>
              <th className="px-4 py-2.5 font-medium">Reason</th>
              <th className="px-4 py-2.5 text-right font-medium">Deducted</th>
              <th className="px-4 py-2.5 text-right font-medium">Loss</th>
              <th className="px-4 py-2.5 font-medium">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">
                  Nothing written off in this period.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id}>
                  <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">
                    {formatDateTime(new Date(log.createdAt))}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="block text-gray-900">{log.productName}</span>
                    <span className="block font-mono text-[11px] text-gray-400">
                      {log.variantBatchId}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        WASTAGE_STYLES[log.reason as WastageReasonValue] ??
                        "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {wastageLabel(log.reason)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right text-gray-600">
                    {log.mlDeducted > 0 && formatMl(log.mlDeducted)}
                    {log.mlDeducted > 0 && log.bottlesDeducted > 0 && " + "}
                    {log.bottlesDeducted > 0 &&
                      `${log.bottlesDeducted} bottle${log.bottlesDeducted === 1 ? "" : "s"}`}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right font-medium text-red-600">
                    {formatCurrency(log.lossValue)}
                  </td>
                  <td className="max-w-[14rem] truncate px-4 py-2.5 text-gray-500">
                    {log.note ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {logs.length > 0 && (
            <tfoot className="border-t border-gray-200 bg-gray-50">
              <tr>
                <td colSpan={4} className="px-4 py-2.5 text-xs font-medium text-gray-500">
                  {logs.length} write-off{logs.length === 1 ? "" : "s"}
                </td>
                <td className="px-4 py-2.5 text-right font-semibold text-red-600">
                  {formatCurrency(grandTotal)}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
