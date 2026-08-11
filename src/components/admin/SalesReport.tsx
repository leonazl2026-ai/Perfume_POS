"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { voidSale } from "@/actions/sales";
import { formatCurrency } from "@/lib/format";
import { formatDateTime, type RangePreset } from "@/lib/dateRange";
import { DateRangeFilter, useFilterParams } from "@/components/admin/FilterBar";
import { ExportButton } from "@/components/admin/ExportButton";
import { DeliveryDialog } from "@/components/admin/DeliveryDialog";
import { DELIVERY_LABELS, DELIVERY_ORDER, DELIVERY_STYLES } from "@/lib/delivery";
import { SaleDetailDialog } from "@/components/admin/SaleDetailDialog";
import { Toast, type ToastMessage } from "@/components/ui/Toast";
import type {
  CustomerBreakdownRow,
  DeliveryStatusValue,
  FinancialSummary,
  SaleRow,
} from "@/types/reports";

interface SalesReportProps {
  summary: FinancialSummary;
  sales: SaleRow[];
  customers: CustomerBreakdownRow[];
  deliveryCounts: Record<DeliveryStatusValue, number>;
  preset: RangePreset;
  rangeLabel: string;
}

export function SalesReport({
  summary,
  sales,
  customers,
  deliveryCounts,
  preset,
  rangeLabel,
}: SalesReportProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setParams = useFilterParams();

  const activeDelivery = searchParams.get("delivery") ?? "";
  const showVoided = searchParams.get("voided") === "1";
  const search = searchParams.get("q") ?? "";

  const [detailId, setDetailId] = useState<string | null>(null);
  const [deliveryTarget, setDeliveryTarget] = useState<SaleRow | null>(null);
  const [confirmVoid, setConfirmVoid] = useState<SaleRow | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [isPending, startTransition] = useTransition();

  const notify = (kind: ToastMessage["kind"], text: string) =>
    setToast({ id: Date.now(), kind, text });

  const handleVoid = (sale: SaleRow) => {
    startTransition(async () => {
      const result = await voidSale(sale.id);
      if (!result.ok) {
        notify("error", result.error);
        return;
      }
      notify("success", `${sale.saleNumber} voided — stock returned.`);
      setConfirmVoid(null);
      router.refresh();
    });
  };

  return (
    <div>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Sales & Reports</h1>
          <p className="text-sm text-gray-500">{rangeLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportButton endpoint="/api/export/sales" label="Export sales" />
          <ExportButton
            endpoint="/api/export/sales"
            label="Export line items"
            extraParams={{ mode: "lines" }}
          />
          <DateRangeFilter preset={preset} />
        </div>
      </header>

      {/* P&L */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Revenue" value={formatCurrency(summary.revenue)} />
        <Stat label="Cost of goods" value={formatCurrency(summary.cogs)} muted />
        <Stat label="Gross profit" value={formatCurrency(summary.grossProfit)} tone="positive" />
        <Stat label="Expenses" value={formatCurrency(summary.expenses)} muted />
        <Stat
          label="Net profit"
          value={formatCurrency(summary.netProfit)}
          tone={summary.netProfit >= 0 ? "positive" : "negative"}
          emphasis
        />
      </div>

      <p className="mb-5 text-xs text-gray-400">
        {summary.saleCount} completed sale{summary.saleCount === 1 ? "" : "s"} · average order{" "}
        {formatCurrency(summary.averageOrderValue)} · net profit = gross profit − operating
        expenses
      </p>

      {/* Fulfilment board */}
      <section className="mb-5">
        <h2 className="mb-2 text-sm font-semibold text-gray-900">Delivery status</h2>
        <div className="flex flex-wrap gap-2">
          {DELIVERY_ORDER.map((status) => {
            const active = activeDelivery === status;
            return (
              <button
                key={status}
                type="button"
                onClick={() => setParams({ delivery: active ? undefined : status })}
                className={`rounded-lg border px-3 py-2 text-left transition ${
                  active ? "border-gray-900 bg-white" : "border-gray-200 bg-white hover:border-gray-400"
                }`}
              >
                <span className="block text-[11px] font-medium text-gray-500">
                  {DELIVERY_LABELS[status]}
                </span>
                <span className="block text-lg font-semibold text-gray-900">
                  {deliveryCounts[status]}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
        {/* Sales history */}
        <section>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900">Sales history</h2>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                defaultValue={search}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setParams({ q: (e.target as HTMLInputElement).value || undefined });
                  }
                }}
                placeholder="Sale #, customer, tracking…"
                className="w-52 rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none transition focus:border-gray-900"
              />
              <label className="flex items-center gap-1.5 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={showVoided}
                  onChange={(e) => setParams({ voided: e.target.checked ? "1" : undefined })}
                  className="h-3.5 w-3.5 rounded border-gray-300"
                />
                Show voided
              </label>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full min-w-[46rem] text-sm">
              <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Sale</th>
                  <th className="px-4 py-2.5 font-medium">Customer</th>
                  <th className="px-4 py-2.5 font-medium">Delivery</th>
                  <th className="px-4 py-2.5 text-right font-medium">Total</th>
                  <th className="px-4 py-2.5 text-right font-medium">Profit</th>
                  <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {sales.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">
                      No sales in this period.
                    </td>
                  </tr>
                ) : (
                  sales.map((sale) => {
                    const voided = sale.status === "VOIDED";
                    return (
                      <tr key={sale.id} className={voided ? "bg-red-50/40" : ""}>
                        <td className="px-4 py-2.5">
                          <button
                            type="button"
                            onClick={() => setDetailId(sale.id)}
                            className="text-left"
                          >
                            <span
                              className={`block font-mono text-xs ${
                                voided ? "text-gray-400 line-through" : "text-gray-900"
                              }`}
                            >
                              {sale.saleNumber}
                            </span>
                            <span className="block text-[11px] text-gray-400">
                              {formatDateTime(new Date(sale.saleDate))} · {sale.itemCount} item
                              {sale.itemCount === 1 ? "" : "s"}
                            </span>
                          </button>
                        </td>

                        <td className="px-4 py-2.5">
                          <span className="block text-gray-900">
                            {sale.customerName ?? "Walk-in"}
                          </span>
                          <span className="block text-[11px] text-gray-400">
                            {sale.paymentMethod}
                          </span>
                        </td>

                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              DELIVERY_STYLES[sale.deliveryStatus]
                            }`}
                          >
                            {DELIVERY_LABELS[sale.deliveryStatus]}
                          </span>
                          {sale.trackingNumber && (
                            <span className="mt-0.5 block truncate font-mono text-[10px] text-gray-400">
                              {sale.courier ? `${sale.courier} · ` : ""}
                              {sale.trackingNumber}
                            </span>
                          )}
                        </td>

                        <td className="whitespace-nowrap px-4 py-2.5 text-right font-medium text-gray-900">
                          {formatCurrency(sale.total)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-2.5 text-right">
                          <span
                            className={
                              voided
                                ? "text-gray-400"
                                : sale.totalProfit >= 0
                                  ? "text-emerald-600"
                                  : "text-red-600"
                            }
                          >
                            {formatCurrency(sale.totalProfit)}
                          </span>
                        </td>

                        <td className="px-4 py-2.5">
                          <div className="flex justify-end gap-2 text-xs font-medium">
                            <button
                              type="button"
                              onClick={() => setDetailId(sale.id)}
                              className="text-gray-600 transition hover:text-gray-900"
                            >
                              View
                            </button>
                            {!voided && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setDeliveryTarget(sale)}
                                  className="text-gray-600 transition hover:text-gray-900"
                                >
                                  Delivery
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmVoid(sale)}
                                  className="text-gray-400 transition hover:text-red-600"
                                >
                                  Void
                                </button>
                              </>
                            )}
                            {voided && (
                              <span className="text-[11px] font-normal text-red-500">Voided</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Customers */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-gray-900">Top customers</h2>
          <div className="rounded-xl border border-gray-200 bg-white">
            {customers.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-gray-400">No sales yet.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {customers.map((customer, index) => (
                  <li
                    key={customer.customerName ?? `walk-in-${index}`}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-gray-900">
                        {customer.customerName ?? "Walk-in"}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {customer.orderCount} order{customer.orderCount === 1 ? "" : "s"} ·{" "}
                        {formatCurrency(customer.totalProfit)} profit
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-medium text-gray-900">
                      {formatCurrency(customer.totalSpend)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <SaleDetailDialog saleId={detailId} onClose={() => setDetailId(null)} />

      <DeliveryDialog
        key={deliveryTarget?.id ?? "none"}
        sale={deliveryTarget}
        onClose={() => setDeliveryTarget(null)}
        onSaved={(message) => {
          notify("success", message);
          router.refresh();
        }}
      />

      {/* Void confirmation — destructive and stock-affecting, so never one-click. */}
      {confirmVoid && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-gray-900">
              Void {confirmVoid.saleNumber}?
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              This returns every bottle and every ml from this sale back into stock, and removes
              it from revenue and profit. The sale stays in history, marked voided.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmVoid(null)}
                disabled={isPending}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-900 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleVoid(confirmVoid)}
                disabled={isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:bg-gray-300"
              >
                {isPending ? "Voiding…" : "Void sale"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
  muted = false,
  emphasis = false,
}: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "negative";
  muted?: boolean;
  emphasis?: boolean;
}) {
  const valueColor =
    tone === "positive" ? "text-emerald-600" : tone === "negative" ? "text-red-600" : "text-gray-900";

  return (
    <div
      className={`rounded-xl border bg-white p-3 ${
        emphasis ? "border-gray-900" : "border-gray-200"
      }`}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p
        className={`mt-1 text-lg font-semibold ${muted ? "text-gray-500" : valueColor}`}
      >
        {value}
      </p>
    </div>
  );
}
