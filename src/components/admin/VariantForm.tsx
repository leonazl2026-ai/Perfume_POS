"use client";

import { useMemo, useState, useTransition } from "react";
import { upsertProductVariant } from "@/actions/products";
import { formatCurrency } from "@/lib/format";
import { Modal } from "@/components/ui/Modal";
import type { AdminProductOption, AdminVariant, SupplierRow } from "@/types/admin";

interface DecantRow {
  sizeMl: string;
  price: string;
}

interface FormState {
  productId: string; // "" = create a new product
  newProductName: string;
  newProductBrand: string;
  supplierId: string;
  variantBatchId: string;
  fullBottleSizeMl: string;
  bottleCost: string;
  vialCost: string;
  fullBottleSellingPrice: string;
  unopenedBottles: string;
  decantActiveRemainingMl: string;
  notes: string;
  decantOptions: DecantRow[];
}

const BLANK: FormState = {
  productId: "",
  newProductName: "",
  newProductBrand: "",
  supplierId: "",
  variantBatchId: "",
  fullBottleSizeMl: "",
  bottleCost: "",
  vialCost: "",
  fullBottleSellingPrice: "",
  unopenedBottles: "0",
  decantActiveRemainingMl: "0",
  notes: "",
  decantOptions: [{ sizeMl: "5", price: "" }, { sizeMl: "10", price: "" }],
};

/** Empty string -> 0 so partially-filled forms still preview cleanly. */
const num = (value: string): number => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function toFormState(variant: AdminVariant): FormState {
  return {
    productId: variant.productId,
    newProductName: "",
    newProductBrand: "",
    supplierId: variant.supplierId ?? "",
    variantBatchId: variant.variantBatchId,
    fullBottleSizeMl: String(variant.fullBottleSizeMl),
    bottleCost: String(variant.bottleCost),
    vialCost: String(variant.vialCost),
    fullBottleSellingPrice: String(variant.fullBottlePrice),
    unopenedBottles: String(variant.unopenedBottles),
    decantActiveRemainingMl: String(variant.decantActiveRemainingMl),
    notes: variant.notes ?? "",
    decantOptions: variant.decantOptions.map((o) => ({
      sizeMl: String(o.sizeMl),
      price: String(o.price),
    })),
  };
}

interface VariantFormProps {
  open: boolean;
  variant: AdminVariant | null; // null = create
  products: AdminProductOption[];
  suppliers: SupplierRow[];
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function VariantForm({
  open,
  variant,
  products,
  suppliers,
  onClose,
  onSaved,
}: VariantFormProps) {
  // Initialized once per mount. The parent remounts this via `key` on every
  // open, so an abandoned draft never leaks into the next dialog.
  const [form, setForm] = useState<FormState>(() => (variant ? toFormState(variant) : BLANK));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startTransition] = useTransition();

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const bottleSize = num(form.fullBottleSizeMl);
  const bottleCost = num(form.bottleCost);
  const vialCost = num(form.vialCost);

  const costPerMl = bottleSize > 0 ? bottleCost / bottleSize : 0;

  // Live margin preview per decant size — mirrors the Excel costing sheet.
  const decantPreview = useMemo(
    () =>
      form.decantOptions.map((row) => {
        const size = num(row.sizeMl);
        const price = num(row.price);
        const unitCost = costPerMl * size + vialCost;
        return {
          size,
          price,
          unitCost,
          profit: price - unitCost,
          margin: price > 0 ? ((price - unitCost) / price) * 100 : 0,
        };
      }),
    [form.decantOptions, costPerMl, vialCost]
  );

  const bottleProfit = num(form.fullBottleSellingPrice) - bottleCost;

  const handleSubmit = () => {
    setError(null);

    startTransition(async () => {
      const result = await upsertProductVariant({
        id: variant?.id,
        productId: form.productId || undefined,
        newProductName: form.productId ? undefined : form.newProductName,
        newProductBrand: form.productId ? undefined : form.newProductBrand,
        variantBatchId: form.variantBatchId,
        supplierId: form.supplierId || null,
        fullBottleSizeMl: num(form.fullBottleSizeMl),
        bottleCost: num(form.bottleCost),
        vialCost: num(form.vialCost),
        fullBottleSellingPrice: num(form.fullBottleSellingPrice),
        unopenedBottles: Math.trunc(num(form.unopenedBottles)),
        decantActiveRemainingMl: num(form.decantActiveRemainingMl),
        notes: form.notes,
        decantOptions: form.decantOptions
          .filter((row) => row.sizeMl.trim() !== "")
          .map((row) => ({ sizeMl: num(row.sizeMl), price: num(row.price) })),
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      onSaved(variant ? "Batch updated." : "Batch created.");
      onClose();
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={variant ? `Edit ${variant.variantBatchId}` : "New Product Batch"}
      subtitle={
        variant
          ? "Stock levels are managed from the Stock actions, not this form."
          : "Opening stock can be entered here; later changes go through Stock actions."
      }
      widthClass="max-w-3xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:bg-gray-300"
          >
            {isSaving ? "Saving…" : "Save Batch"}
          </button>
        </>
      }
    >
      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="space-y-5">
        {/* Product identity */}
        <section>
          <SectionTitle>Product</SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Existing product">
              <select
                value={form.productId}
                onChange={(e) => set("productId", e.target.value)}
                className={inputClass}
              >
                <option value="">— Create new product —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.brand ? `${p.brand} — ${p.name}` : p.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Variant Batch ID" hint="Unique, e.g. BDC100-B01">
              <input
                value={form.variantBatchId}
                onChange={(e) => set("variantBatchId", e.target.value)}
                className={inputClass}
                placeholder="BDC100-B01"
              />
            </Field>

            <Field
              label="Supplier"
              hint={
                suppliers.length === 0
                  ? "No suppliers yet — add them under Admin → Suppliers."
                  : undefined
              }
            >
              <select
                value={form.supplierId}
                onChange={(e) => set("supplierId", e.target.value)}
                className={inputClass}
              >
                <option value="">— No supplier —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.phone ? `${s.name} (${s.phone})` : s.name}
                  </option>
                ))}
              </select>
            </Field>

            {!form.productId && (
              <>
                <Field label="New product name">
                  <input
                    value={form.newProductName}
                    onChange={(e) => set("newProductName", e.target.value)}
                    className={inputClass}
                    placeholder="Bleu de Chanel EDP"
                  />
                </Field>
                <Field label="Brand">
                  <input
                    value={form.newProductBrand}
                    onChange={(e) => set("newProductBrand", e.target.value)}
                    className={inputClass}
                    placeholder="Chanel"
                  />
                </Field>
              </>
            )}
          </div>
        </section>

        {/* Costing */}
        <section>
          <SectionTitle>Costing</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Bottle size (ml)">
              <input
                type="number"
                min="0"
                step="0.1"
                value={form.fullBottleSizeMl}
                onChange={(e) => set("fullBottleSizeMl", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Bottle cost">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.bottleCost}
                onChange={(e) => set("bottleCost", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Vial cost">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.vialCost}
                onChange={(e) => set("vialCost", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Bottle selling price">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.fullBottleSellingPrice}
                onChange={(e) => set("fullBottleSellingPrice", e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="mt-2 flex flex-wrap gap-4 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
            <span>
              Cost per ml:{" "}
              <strong className="text-gray-900">{formatCurrency(costPerMl)}</strong>
            </span>
            <span>
              Full bottle profit:{" "}
              <strong className={bottleProfit >= 0 ? "text-emerald-600" : "text-red-600"}>
                {formatCurrency(bottleProfit)}
              </strong>
            </span>
          </div>
        </section>

        {/* Opening stock — create only */}
        {!variant && (
          <section>
            <SectionTitle>Opening stock</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Sealed bottles">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.unopenedBottles}
                  onChange={(e) => set("unopenedBottles", e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Active decant ml" hint="Volume already open for pouring">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.decantActiveRemainingMl}
                  onChange={(e) => set("decantActiveRemainingMl", e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
          </section>
        )}

        {/* Decant options */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <SectionTitle className="mb-0">Decant sizes & prices</SectionTitle>
            <button
              type="button"
              onClick={() =>
                set("decantOptions", [...form.decantOptions, { sizeMl: "", price: "" }])
              }
              className="text-xs font-medium text-gray-600 transition hover:text-gray-900"
            >
              + Add size
            </button>
          </div>

          {form.decantOptions.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-300 px-3 py-4 text-center text-xs text-gray-500">
              No decant sizes — this batch will sell as full bottles only.
            </p>
          ) : (
            <div className="space-y-2">
              {form.decantOptions.map((row, index) => {
                const preview = decantPreview[index];
                return (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={row.sizeMl}
                      onChange={(e) => {
                        const next = [...form.decantOptions];
                        next[index] = { ...next[index], sizeMl: e.target.value };
                        set("decantOptions", next);
                      }}
                      placeholder="ml"
                      className={`${inputClass} w-24`}
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.price}
                      onChange={(e) => {
                        const next = [...form.decantOptions];
                        next[index] = { ...next[index], price: e.target.value };
                        set("decantOptions", next);
                      }}
                      placeholder="price"
                      className={`${inputClass} w-28`}
                    />
                    <p className="flex-1 truncate text-xs text-gray-500">
                      cost {formatCurrency(preview.unitCost)} · profit{" "}
                      <span
                        className={preview.profit >= 0 ? "text-emerald-600" : "text-red-600"}
                      >
                        {formatCurrency(preview.profit)}
                      </span>{" "}
                      ({preview.margin.toFixed(0)}%)
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        set(
                          "decantOptions",
                          form.decantOptions.filter((_, i) => i !== index)
                        )
                      }
                      aria-label="Remove decant size"
                      className="px-1 text-gray-400 transition hover:text-red-600"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <Field label="Notes">
          <textarea
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows={2}
            className={inputClass}
            placeholder="Supplier, invoice reference, batch condition…"
          />
        </Field>
      </div>
    </Modal>
  );
}

// ─── Shared bits ─────────────────────────────────────────────────────

const inputClass =
  "w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm outline-none transition focus:border-gray-900 disabled:bg-gray-50";

function SectionTitle({
  children,
  className = "mb-2",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h3 className={`text-xs font-semibold uppercase tracking-wide text-gray-400 ${className}`}>
      {children}
    </h3>
  );
}

function Field({
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
