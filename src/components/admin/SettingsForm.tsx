"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSettings } from "@/actions/settings";
import { formatCurrency } from "@/lib/format";
import { Toast, type ToastMessage } from "@/components/ui/Toast";
import type { AppSettings } from "@/lib/settings";

type FormState = Record<keyof AppSettings, string>;

const toForm = (settings: AppSettings): FormState => ({
  lowStockBottles: String(settings.lowStockBottles),
  lowStockMl: String(settings.lowStockMl),
  tierRegularSpend: String(settings.tierRegularSpend),
  tierRegularOrders: String(settings.tierRegularOrders),
  tierVipSpend: String(settings.tierVipSpend),
  tierVipOrders: String(settings.tierVipOrders),
  slowMovingDays: String(settings.slowMovingDays),
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

  const set = (key: keyof AppSettings, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

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
