"use client";

import { useEffect, useState } from "react";
import { fetchCustomerDetail } from "@/actions/customers";
import { formatCurrency } from "@/lib/format";
import { formatDate } from "@/lib/dateRange";
import { CHANNEL_LABELS, CHANNEL_STYLES, CHANNEL_SHORT } from "@/lib/channels";
import { TIER_LABELS, TIER_STYLES } from "@/lib/tiers";
import { paymentLabel } from "@/lib/paymentMethods";
import { Modal } from "@/components/ui/Modal";
import type { CustomerDetail } from "@/types/crm";

export function CustomerDetailDialog({
  customerId,
  onClose,
}: {
  customerId: string | null;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!customerId) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchCustomerDetail(customerId)
      .then((result) => {
        if (!cancelled) setDetail(result);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [customerId]);

  if (!customerId) return null;

  return (
    <Modal
      open={Boolean(customerId)}
      onClose={onClose}
      title={detail?.name ?? detail?.phone ?? "Customer"}
      subtitle={detail?.phone ?? undefined}
      widthClass="max-w-3xl"
    >
      {loading || !detail ? (
        <p className="py-10 text-center text-sm text-gray-400">Loading…</p>
      ) : (
        <div className="space-y-5">
          {/* Profile */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TIER_STYLES[detail.tier]}`}
            >
              {TIER_LABELS[detail.tier]}
              {detail.tierLocked && " · pinned"}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CHANNEL_STYLES[detail.channel]}`}
            >
              {CHANNEL_LABELS[detail.channel]}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Total orders" value={String(detail.totalOrders)} />
            <Stat label="Total spent" value={formatCurrency(detail.totalSpent)} />
            <Stat
              label="Avg order"
              value={formatCurrency(
                detail.totalOrders > 0 ? detail.totalSpent / detail.totalOrders : 0
              )}
            />
            <Stat
              label="Last purchase"
              value={
                detail.lastPurchaseAt ? formatDate(new Date(detail.lastPurchaseAt)) : "Never"
              }
            />
          </div>

          {detail.address && (
            <Section title="Delivery address">
              <p className="whitespace-pre-line text-sm text-gray-700">{detail.address}</p>
            </Section>
          )}

          {detail.favouriteSizes.length > 0 && (
            <Section title="Buys most often">
              <div className="flex flex-wrap gap-1.5">
                {detail.favouriteSizes.map((size) => (
                  <span
                    key={size.label}
                    className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700"
                  >
                    {size.label} · {size.quantity}×
                  </span>
                ))}
              </div>
            </Section>
          )}

          {detail.preferences && (
            <Section title="Fragrance preferences">
              <p className="whitespace-pre-line text-sm text-gray-700">{detail.preferences}</p>
            </Section>
          )}

          {detail.notes && (
            <Section title="Notes">
              <p className="whitespace-pre-line text-sm text-gray-700">{detail.notes}</p>
            </Section>
          )}

          {/* Purchase history */}
          <Section title={`Purchase history (${detail.purchases.length})`}>
            {detail.purchases.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">No orders yet.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {detail.purchases.map((purchase) => (
                  <li key={purchase.saleId} className="py-2.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`font-mono text-xs ${
                            purchase.status === "VOIDED"
                              ? "text-gray-400 line-through"
                              : "text-gray-900"
                          }`}
                        >
                          {purchase.saleNumber}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          {formatDate(new Date(purchase.saleDate))} ·{" "}
                          {CHANNEL_SHORT[purchase.channel]} · {paymentLabel(purchase.paymentMethod)}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {formatCurrency(purchase.total)}
                      </span>
                    </div>

                    <ul className="mt-1 space-y-0.5">
                      {purchase.lines.map((line, index) => (
                        <li key={index} className="text-[11px] text-gray-500">
                          {line.quantity}× {line.name} — {line.detail}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 p-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
        {title}
      </h3>
      {children}
    </div>
  );
}
