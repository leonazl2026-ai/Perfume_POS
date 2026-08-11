"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { voidWastage } from "@/actions/wastage";
import { formatCurrency, formatMl } from "@/lib/format";
import { formatDateTime } from "@/lib/dateRange";
import { wastageLabel, WASTAGE_STYLES, type WastageReasonValue } from "@/lib/wastage";
import { Toast, type ToastMessage } from "@/components/ui/Toast";
import type { WastageRow } from "@/types/reports";

export function WastageTable({ logs }: { logs: WastageRow[] }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<WastageRow | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeTotal = logs
    .filter((log) => !log.voidedAt)
    .reduce((sum, log) => sum + log.lossValue, 0);

  const handleVoid = (log: WastageRow) => {
    startTransition(async () => {
      const result = await voidWastage(log.id);

      if (!result.ok) {
        setToast({ id: Date.now(), kind: "error", text: result.error });
        return;
      }

      setToast({
        id: Date.now(),
        kind: "success",
        text: "Write-off reverted — stock restored and expense removed.",
      });
      setConfirming(null);
      router.refresh();
    });
  };

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[52rem] text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">Product / Batch</th>
              <th className="px-4 py-2.5 font-medium">Reason</th>
              <th className="px-4 py-2.5 text-right font-medium">Deducted</th>
              <th className="px-4 py-2.5 text-right font-medium">Loss</th>
              <th className="px-4 py-2.5 font-medium">Note</th>
              <th className="px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">
                  Nothing written off in this period.
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const voided = Boolean(log.voidedAt);
                return (
                  <tr key={log.id} className={voided ? "bg-gray-50/70 text-gray-400" : ""}>
                    <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">
                      {formatDateTime(new Date(log.createdAt))}
                    </td>

                    <td className="px-4 py-2.5">
                      <span className={voided ? "block line-through" : "block text-gray-900"}>
                        {log.productName}
                      </span>
                      <span className="block font-mono text-[11px] text-gray-400">
                        {log.variantBatchId}
                        {log.supplierName && ` · ${log.supplierName}`}
                      </span>
                    </td>

                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          voided
                            ? "bg-gray-200 text-gray-500"
                            : WASTAGE_STYLES[log.reason as WastageReasonValue] ??
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

                    <td
                      className={`whitespace-nowrap px-4 py-2.5 text-right font-medium ${
                        voided ? "text-gray-400 line-through" : "text-red-600"
                      }`}
                    >
                      {formatCurrency(log.lossValue)}
                    </td>

                    <td className="max-w-[12rem] truncate px-4 py-2.5 text-gray-500">
                      {log.note ?? "—"}
                    </td>

                    <td className="px-4 py-2.5 text-right">
                      {voided ? (
                        <span className="text-[11px] font-medium text-gray-400">Voided</span>
                      ) : (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => setConfirming(log)}
                          className="text-xs font-medium text-gray-500 transition hover:text-red-600 disabled:opacity-50"
                        >
                          Void / Revert
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>

          {logs.length > 0 && (
            <tfoot className="border-t border-gray-200 bg-gray-50">
              <tr>
                <td colSpan={4} className="px-4 py-2.5 text-xs font-medium text-gray-500">
                  {logs.length} entr{logs.length === 1 ? "y" : "ies"} · voided rows excluded from
                  the total
                </td>
                <td className="px-4 py-2.5 text-right font-semibold text-red-600">
                  {formatCurrency(activeTotal)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Reversal touches stock and the P&L, so it is never one-click. */}
      {confirming && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-gray-900">Revert this write-off?</h3>
            <p className="mt-1 text-sm text-gray-600">
              {confirming.mlDeducted > 0 && `${formatMl(confirming.mlDeducted)} `}
              {confirming.mlDeducted > 0 && confirming.bottlesDeducted > 0 && "and "}
              {confirming.bottlesDeducted > 0 &&
                `${confirming.bottlesDeducted} bottle${
                  confirming.bottlesDeducted === 1 ? "" : "s"
                } `}
              will go back into <strong>{confirming.variantBatchId}</strong>, and the{" "}
              {formatCurrency(confirming.lossValue)} expense will be removed so net profit
              recovers.
            </p>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(null)}
                disabled={isPending}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-900 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleVoid(confirming)}
                disabled={isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:bg-gray-300"
              >
                {isPending ? "Reverting…" : "Revert"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
