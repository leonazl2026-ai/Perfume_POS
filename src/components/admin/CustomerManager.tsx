"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { deleteCustomer, upsertCustomer } from "@/actions/customers";
import { formatCurrency } from "@/lib/format";
import { formatDate } from "@/lib/dateRange";
import { CHANNEL_LABELS, CHANNEL_SHORT, CHANNEL_STYLES, ORDER_CHANNELS } from "@/lib/channels";
import { CUSTOMER_TIERS, TIER_LABELS, TIER_STYLES } from "@/lib/tiers";
import { useFilterParams } from "@/components/admin/FilterBar";
import { CustomerDetailDialog } from "@/components/admin/CustomerDetailDialog";
import { LoyaltyDialog } from "@/components/admin/LoyaltyDialog";
import type { LoyaltyConfig } from "@/lib/settings";
import { Modal } from "@/components/ui/Modal";
import { Toast, type ToastMessage } from "@/components/ui/Toast";
import type { CrmSummary, CustomerRow } from "@/types/crm";
import type { OrderChannelValue } from "@/lib/channels";
import type { CustomerTierValue } from "@/lib/tiers";

interface FormState {
  id?: string;
  name: string;
  phone: string;
  address: string;
  channel: OrderChannelValue;
  tier: CustomerTierValue;
  tierLocked: boolean;
  preferences: string;
  notes: string;
}

const BLANK: FormState = {
  name: "",
  phone: "",
  address: "",
  channel: "WALK_IN",
  tier: "NEW",
  tierLocked: false,
  preferences: "",
  notes: "",
};

export function CustomerManager({
  customers,
  summary,
  loyalty,
}: {
  customers: CustomerRow[];
  summary: CrmSummary;
  loyalty: LoyaltyConfig;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setParams = useFilterParams();

  const activeTier = searchParams.get("tier") ?? "";
  const activeChannel = searchParams.get("channel") ?? "";

  const [detailId, setDetailId] = useState<string | null>(null);
  const [pointsTarget, setPointsTarget] = useState<CustomerRow | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [isPending, startTransition] = useTransition();

  const notify = (kind: ToastMessage["kind"], text: string) =>
    setToast({ id: Date.now(), kind, text });

  const openForm = (customer?: CustomerRow) => {
    setError(null);
    setForm(
      customer
        ? {
            id: customer.id,
            name: customer.name ?? "",
            phone: customer.phone ?? "",
            address: customer.address ?? "",
            channel: customer.channel,
            tier: customer.tier,
            tierLocked: customer.tierLocked,
            preferences: customer.preferences ?? "",
            notes: customer.notes ?? "",
          }
        : BLANK
    );
  };

  const save = () => {
    if (!form) return;
    setError(null);

    startTransition(async () => {
      const result = await upsertCustomer(form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      notify("success", form.id ? "Customer updated." : "Customer created.");
      setForm(null);
      router.refresh();
    });
  };

  const remove = (customer: CustomerRow) => {
    startTransition(async () => {
      const result = await deleteCustomer(customer.id);
      notify(result.ok ? "success" : "error", result.ok ? "Customer deleted." : result.error);
      if (result.ok) router.refresh();
    });
  };

  return (
    <div>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500">
            {summary.total} in the CRM · {summary.byTier.VIP} VIP · {summary.byTier.REGULAR}{" "}
            regular
          </p>
        </div>
        <button
          type="button"
          onClick={() => openForm()}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
        >
          + New Customer
        </button>
      </header>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          defaultValue={searchParams.get("q") ?? ""}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setParams({ q: (e.target as HTMLInputElement).value || undefined });
            }
          }}
          placeholder="Search name, phone, address… (Enter)"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-gray-900 sm:max-w-xs"
        />

        <div className="flex gap-1 rounded-lg bg-gray-200/70 p-1">
          {CUSTOMER_TIERS.map((tier) => (
            <button
              key={tier}
              type="button"
              onClick={() => setParams({ tier: activeTier === tier ? undefined : tier })}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                activeTier === tier
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {TIER_LABELS[tier]} ({summary.byTier[tier]})
            </button>
          ))}
        </div>

        <select
          value={activeChannel}
          onChange={(e) => setParams({ channel: e.target.value || undefined })}
          className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs outline-none focus:border-gray-900"
        >
          <option value="">All channels</option>
          {ORDER_CHANNELS.map((channel) => (
            <option key={channel} value={channel}>
              {CHANNEL_LABELS[channel]} ({summary.byChannel[channel] ?? 0})
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[56rem] text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Customer</th>
              <th className="px-4 py-2.5 font-medium">Address</th>
              <th className="px-4 py-2.5 font-medium">Channel</th>
              <th className="px-4 py-2.5 font-medium">Tier</th>
              <th className="px-4 py-2.5 text-right font-medium">Orders</th>
              <th className="px-4 py-2.5 text-right font-medium">Spent</th>
              <th className="px-4 py-2.5 text-right font-medium">Points</th>
              <th className="px-4 py-2.5 font-medium">Last purchase</th>
              <th className="px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {customers.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-sm text-gray-400">
                  No customers match these filters. Customers are created automatically when a
                  sale records a phone number.
                </td>
              </tr>
            ) : (
              customers.map((customer) => (
                <tr key={customer.id}>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setDetailId(customer.id)}
                      className="text-left"
                    >
                      <span className="block font-medium text-gray-900">
                        {customer.name ?? "Unnamed"}
                      </span>
                      <span className="block text-[11px] text-gray-400">
                        {customer.phone ?? "No phone"}
                      </span>
                    </button>
                  </td>
                  <td className="max-w-[14rem] truncate px-4 py-3 text-gray-500">
                    {customer.address ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CHANNEL_STYLES[customer.channel]}`}
                    >
                      {CHANNEL_SHORT[customer.channel]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TIER_STYLES[customer.tier]}`}
                    >
                      {TIER_LABELS[customer.tier]}
                    </span>
                    {customer.tierLocked && (
                      <span className="ml-1 text-[10px] text-gray-400">pinned</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">{customer.totalOrders}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {formatCurrency(customer.totalSpent)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setPointsTarget(customer)}
                      title="View point history / adjust"
                      className={`rounded-full px-2 py-0.5 text-xs font-medium transition ${
                        customer.points > 0
                          ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {customer.points} pts
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                    {customer.lastPurchaseAt
                      ? formatDate(new Date(customer.lastPurchaseAt))
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2 text-xs font-medium">
                      <button
                        type="button"
                        onClick={() => setDetailId(customer.id)}
                        className="text-gray-600 transition hover:text-gray-900"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => setPointsTarget(customer)}
                        className="text-gray-600 transition hover:text-gray-900"
                      >
                        Points
                      </button>
                      <button
                        type="button"
                        onClick={() => openForm(customer)}
                        className="text-gray-600 transition hover:text-gray-900"
                      >
                        Edit
                      </button>
                      {customer.totalOrders === 0 && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => remove(customer)}
                          className="text-gray-400 transition hover:text-red-600 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit / create */}
      <Modal
        open={form !== null}
        onClose={() => setForm(null)}
        title={form?.id ? "Edit customer" : "New customer"}
        footer={
          <>
            <button
              type="button"
              onClick={() => setForm(null)}
              disabled={isPending}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-900 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={isPending}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:bg-gray-300"
            >
              {isPending ? "Saving…" : "Save customer"}
            </button>
          </>
        }
      >
        {form && (
          <div className="space-y-3">
            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Labelled label="Name">
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputClass}
                />
              </Labelled>
              <Labelled label="Phone" hint="Used to match repeat buyers at the till">
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className={inputClass}
                  placeholder="09xxxxxxxxx"
                />
              </Labelled>
            </div>

            <Labelled label="Delivery address">
              <textarea
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                rows={2}
                className={inputClass}
              />
            </Labelled>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Labelled label="Primary acquisition channel">
                <select
                  value={form.channel}
                  onChange={(e) =>
                    setForm({ ...form, channel: e.target.value as OrderChannelValue })
                  }
                  className={inputClass}
                >
                  {ORDER_CHANNELS.map((channel) => (
                    <option key={channel} value={channel}>
                      {CHANNEL_LABELS[channel]}
                    </option>
                  ))}
                </select>
              </Labelled>

              <Labelled
                label="Tier"
                hint={form.tierLocked ? "Pinned — automatic banding is off" : "Set automatically"}
              >
                <div className="flex items-center gap-2">
                  <select
                    value={form.tier}
                    disabled={!form.tierLocked}
                    onChange={(e) =>
                      setForm({ ...form, tier: e.target.value as CustomerTierValue })
                    }
                    className={`${inputClass} disabled:bg-gray-50 disabled:text-gray-400`}
                  >
                    {CUSTOMER_TIERS.map((tier) => (
                      <option key={tier} value={tier}>
                        {TIER_LABELS[tier]}
                      </option>
                    ))}
                  </select>
                  <label className="flex shrink-0 items-center gap-1 text-[11px] text-gray-600">
                    <input
                      type="checkbox"
                      checked={form.tierLocked}
                      onChange={(e) => setForm({ ...form, tierLocked: e.target.checked })}
                      className="h-3.5 w-3.5 rounded border-gray-300"
                    />
                    Pin
                  </label>
                </div>
              </Labelled>
            </div>

            <Labelled label="Fragrance preferences">
              <textarea
                value={form.preferences}
                onChange={(e) => setForm({ ...form, preferences: e.target.value })}
                rows={2}
                className={inputClass}
                placeholder="Likes woody / oud, dislikes sweet gourmands…"
              />
            </Labelled>

            <Labelled label="Notes">
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className={inputClass}
              />
            </Labelled>
          </div>
        )}
      </Modal>

      <CustomerDetailDialog customerId={detailId} onClose={() => setDetailId(null)} />

      <LoyaltyDialog
        key={pointsTarget?.id ?? "none"}
        customer={pointsTarget}
        loyalty={loyalty}
        onClose={() => setPointsTarget(null)}
        onAdjusted={(message) => notify("success", message)}
      />
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm outline-none transition focus:border-gray-900";

function Labelled({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-gray-600">{label}</span>
      {children}
      {hint && <span className="mt-0.5 block text-[11px] text-gray-400">{hint}</span>}
    </label>
  );
}
