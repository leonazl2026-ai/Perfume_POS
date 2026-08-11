"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSettings } from "@/actions/settings";
import { formatCurrency } from "@/lib/format";
import { Toast, type ToastMessage } from "@/components/ui/Toast";
import type { AppSettings } from "@/lib/settings";

/** Numeric fields are held as strings so partial typing doesn't fight the input. */
type NumericKey = Exclude<keyof AppSettings, "loyaltyEnabled">;
type FormState = Record<NumericKey, string> & { loyaltyEnabled: boolean };

const toForm = (settings: AppSettings): FormState => ({
  lowStockBottles: String(settings.lowStockBottles),
  lowStockMl: String(settings.lowStockMl),
  tierRegularSpend: String(settings.tierRegularSpend),
  tierRegularOrders: String(settings.tierRegularOrders),
  tierVipSpend: String(settings.tierVipSpend),
  tierVipOrders: String(settings.tierVipOrders),
  slowMovingDays: String(settings.slowMovingDays),
  loyaltyEnabled: settings.loyaltyEnabled,
  earnRateAmount: String(settings.earnRateAmount),
  pointsEarnedPerRate: String(settings.pointsEarnedPerRate),
  redeemPointValue: String(settings.redeemPointValue),
});

const num = (value: string): number => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function SettingsForm({ settings }: { settings: AppSettings }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => toForm(settings));
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [isPending, startTransition] = useTransition();

  const set = (key: NumericKey, value: string) => setForm((f) => ({ ...f, [key]: value }));

  // Live echo of the loyalty rules, so the admin sees the effect as they type.
  const earnRate = num(form.earnRateAmount);
  const pointsPerRate = num(form.pointsEarnedPerRate);
  const pointValue = num(form.redeemPointValue);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await saveSettings({
        lowStockBottles: Math.trunc(num(form.lowStockBottles)),
        lowStockMl: num(form.lowStockMl),
        tierRegularSpend: num(form.tierRegularSpend),
        tierRegularOrders: Math.trunc(num(form.tierRegularOrders)),
        tierVipSpend: num(form.tierVipSpend),
        tierVipOrders: Math.trunc(num(form.tierVipOrders)),
        slowMovingDays: Math.trunc(num(form.slowMovingDays)),
        loyaltyEnabled: form.loyaltyEnabled,
        earnRateAmount: Math.trunc(num(form.earnRateAmount)),
        pointsEarnedPerRate: Math.trunc(num(form.pointsEarnedPerRate)),
        redeemPointValue: Math.trunc(num(form.redeemPointValue)),
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setToast({ id: Date.now(), kind: "success", text: "Settings saved." });
      router.refresh();
    });
  };

  return (
    <div className="max-w-2xl">
      <header className="mb-5">
        <h1 className="text-lg font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500">Thresholds used by alerts, tiers, and reports.</p>
      </header>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="space-y-4">
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="mb-1 text-sm font-semibold text-gray-900">Low stock alerts</h2>
          <p className="mb-3 text-xs text-gray-500">
            Batches at or below either figure appear in &ldquo;Running Low&rdquo; on the
            dashboard.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sealed bottles at or below">
              <input
                type="number"
                min="0"
                step="1"
                value={form.lowStockBottles}
                onChange={(e) => set("lowStockBottles", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Active ml at or below">
              <input
                type="number"
                min="0"
                step="1"
                value={form.lowStockMl}
                onChange={(e) => set("lowStockMl", e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="mb-1 text-sm font-semibold text-gray-900">Customer tiers</h2>
          <p className="mb-3 text-xs text-gray-500">
            A customer reaches a tier by hitting either the spend or the order-count cutoff.
            Pinned customers are never re-banded.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Regular — spend (${formatCurrency(num(form.tierRegularSpend))})`}>
              <input
                type="number"
                min="0"
                step="1000"
                value={form.tierRegularSpend}
                onChange={(e) => set("tierRegularSpend", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Regular — orders">
              <input
                type="number"
                min="0"
                step="1"
                value={form.tierRegularOrders}
                onChange={(e) => set("tierRegularOrders", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label={`VIP — spend (${formatCurrency(num(form.tierVipSpend))})`}>
              <input
                type="number"
                min="0"
                step="1000"
                value={form.tierVipSpend}
                onChange={(e) => set("tierVipSpend", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="VIP — orders">
              <input
                type="number"
                min="0"
                step="1"
                value={form.tierVipOrders}
                onChange={(e) => set("tierVipOrders", e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
          <p className="mt-2 text-[11px] text-gray-400">
            Existing customers are re-banded the next time they buy, or when you save their
            profile.
          </p>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-1 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-gray-900">Loyalty system</h2>
            <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
              <input
                type="checkbox"
                checked={form.loyaltyEnabled}
                onChange={(e) => setForm((f) => ({ ...f, loyaltyEnabled: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300"
              />
              Enabled
            </label>
          </div>
          <p className="mb-3 text-xs text-gray-500">
            {form.loyaltyEnabled
              ? `Customers earn ${pointsPerRate} point${
                  pointsPerRate === 1 ? "" : "s"
                } per ${formatCurrency(earnRate)} spent. Each point is worth ${formatCurrency(
                  pointValue
                )} off a future order.`
              : "Turned off — no points are earned and redemption is hidden at the till."}
          </p>

          <div
            className={`grid grid-cols-2 gap-3 lg:grid-cols-3 ${
              form.loyaltyEnabled ? "" : "opacity-50"
            }`}
          >
            <Field label="Spend per earn (Ks)">
              <input
                type="number"
                min="1"
                step="100"
                value={form.earnRateAmount}
                disabled={!form.loyaltyEnabled}
                onChange={(e) => set("earnRateAmount", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Points earned per that amount">
              <input
                type="number"
                min="1"
                step="1"
                value={form.pointsEarnedPerRate}
                disabled={!form.loyaltyEnabled}
                onChange={(e) => set("pointsEarnedPerRate", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Value of 1 point (Ks)">
              <input
                type="number"
                min="1"
                step="1"
                value={form.redeemPointValue}
                disabled={!form.loyaltyEnabled}
                onChange={(e) => set("redeemPointValue", e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <p className="mt-2 text-[11px] text-gray-400">
            Rate changes apply to future sales only — points already earned keep their value at
            the current redemption rate.
          </p>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="mb-1 text-sm font-semibold text-gray-900">Slow-moving stock</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Default window (days)">
              <input
                type="number"
                min="1"
                step="1"
                value={form.slowMovingDays}
                onChange={(e) => set("slowMovingDays", e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        </section>
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={isPending}
        className="mt-4 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:bg-gray-300"
      >
        {isPending ? "Saving…" : "Save settings"}
      </button>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm outline-none transition focus:border-gray-900";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-gray-600">{label}</span>
      {children}
    </label>
  );
}
