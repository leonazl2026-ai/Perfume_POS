"use client";

import { useEffect, useState } from "react";
import { fetchSaleDetail } from "@/actions/sales";
import { formatCurrency } from "@/lib/format";
import { formatDateTime } from "@/lib/dateRange";
import { Modal } from "@/components/ui/Modal";
import { DELIVERY_LABELS, DELIVERY_STYLES } from "@/lib/delivery";
import { paymentLabel } from "@/lib/paymentMethods";
import { channelLabel } from "@/lib/channels";
import type { SaleDetail } from "@/types/reports";

/** Loads a sale's full line items on demand rather than shipping them with the list. */
export function SaleDetailDialog({
  saleId,
  onClose,
}: {
  saleId: string | null;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<SaleDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!saleId) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchSaleDetail(saleId)
      .then((result) => {
        // Ignore a resolved fetch for a dialog the user already closed.
        if (!cancelled) setDetail(result);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [saleId]);

  if (!saleId) return null;

  return (
    <Modal
      open={Boolean(saleId)}
      onClose={onClose}
      title={detail?.saleNumber ?? "Sale"}
      subtitle={
        detail
          ? `${formatDateTime(new Date(detail.saleDate))} · ${
              detail.customerName ?? "Walk-in"
            } · ${paymentLabel(detail.paymentMethod)} · ${channelLabel(detail.orderChannel)}`
          : undefined
      }
    >
      {loading || !detail ? (
        <p className="py-10 text-center text-sm text-gray-400">Loading…</p>
      ) : (
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                DELIVERY_STYLES[detail.deliveryStatus]
              }`}
            >
              {DELIVERY_LABELS[detail.deliveryStatus]}
            </span>
            {detail.status === "VOIDED" && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
                Voided
              </span>
            )}
            {detail.trackingNumber && (
              <span className="font-mono text-[11px] text-gray-500">
                {detail.courier ? `${detail.courier} · ` : ""}
                {detail.trackingNumber}
              </span>
            )}
          </div>

          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
              <tr>
                <th className="pb-2 font-medium">Item</th>
                <th className="pb-2 text-center font-medium">Qty</th>
                <th className="pb-2 text-right font-medium">Total</th>
                <th className="pb-2 text-right font-medium">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {detail.lineItems.map((line) => (
                <tr key={line.id}>
                  <td className="py-2">
                    <span className="block text-gray-900">{line.name}</span>
                    <span className="block text-[11px] text-gray-400">{line.detail}</span>
                    {/* Traceability: which batch this poured from, and who supplied it. */}
                    {line.batchId && (
                      <span className="mt-0.5 block font-mono text-[10px] text-gray-400">
                        Batch: {line.batchId}
                        {line.supplierName && (
                          <span className="font-sans"> | Supplier: {line.supplierName}</span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-center text-gray-600">{line.quantity}</td>
                  <td className="py-2 text-right text-gray-900">
                    {formatCurrency(line.lineTotal)}
                  </td>
                  <td className="py-2 text-right text-emerald-600">
                    {formatCurrency(line.lineProfit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <dl className="mt-4 space-y-1 border-t border-gray-100 pt-3 text-sm">
            <Row label="Subtotal" value={formatCurrency(detail.subtotal)} />
            {detail.discount > 0 && (
              <Row label="Discount" value={`− ${formatCurrency(detail.discount)}`} />
            )}
            {detail.tax > 0 && <Row label="Tax" value={formatCurrency(detail.tax)} />}
            <Row label="Cost of goods" value={formatCurrency(detail.totalCost)} />
            <div className="flex justify-between pt-1 font-semibold">
              <dt className="text-gray-900">Total</dt>
              <dd className="text-gray-900">{formatCurrency(detail.total)}</dd>
            </div>
            <div className="flex justify-between font-semibold">
              <dt className="text-gray-900">Net profit</dt>
              <dd className="text-emerald-600">{formatCurrency(detail.totalProfit)}</dd>
            </div>
          </dl>

          {detail.deliveryAddress && (
            <p className="mt-3 whitespace-pre-line rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
              {detail.deliveryAddress}
            </p>
          )}
          {detail.notes && (
            <p className="mt-2 whitespace-pre-line text-xs text-gray-500">{detail.notes}</p>
          )}
        </div>
      )}
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-gray-500">
      <dt>{label}</dt>
      <dd className="text-gray-900">{value}</dd>
    </div>
  );
}
