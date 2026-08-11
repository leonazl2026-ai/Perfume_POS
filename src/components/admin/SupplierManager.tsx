"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteSupplier, setSupplierActive, upsertSupplier } from "@/actions/suppliers";
import { Modal } from "@/components/ui/Modal";
import { Toast, type ToastMessage } from "@/components/ui/Toast";
import type { SupplierRow } from "@/types/admin";

interface FormState {
  id?: string;
  name: string;
  phone: string;
  contactLink: string;
  address: string;
  notes: string;
}

const BLANK: FormState = {
  name: "",
  phone: "",
  contactLink: "",
  address: "",
  notes: "",
};

export function SupplierManager({ suppliers }: { suppliers: SupplierRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Set once the duplicate warning has been shown, to allow saving anyway. */
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [isPending, startTransition] = useTransition();

  const search = query.trim().toLowerCase();
  const rows = useMemo(
    () =>
      suppliers.filter((s) => {
        if (!showInactive && !s.isActive) return false;
        if (!search) return true;
        return (
          s.name.toLowerCase().includes(search) ||
          (s.phone ?? "").toLowerCase().includes(search) ||
          (s.address ?? "").toLowerCase().includes(search)
        );
      }),
    [suppliers, search, showInactive]
  );

  const notify = (kind: ToastMessage["kind"], text: string) =>
    setToast({ id: Date.now(), kind, text });

  const openForm = (supplier?: SupplierRow) => {
    setForm(
      supplier
        ? {
            id: supplier.id,
            name: supplier.name,
            phone: supplier.phone ?? "",
            contactLink: supplier.contactLink ?? "",
            address: supplier.address ?? "",
            notes: supplier.notes ?? "",
          }
        : BLANK
    );
    setError(null);
    setDuplicateWarning(null);
  };

  const save = (confirmDuplicate: boolean) => {
    if (!form) return;
    setError(null);

    startTransition(async () => {
      const result = await upsertSupplier({ ...form, confirmDuplicate });

      if (!result.ok) {
        // A duplicate rejection is recoverable — offer to save anyway.
        if (result.error.includes("already exists")) {
          setDuplicateWarning(result.error);
        } else {
          setError(result.error);
        }
        return;
      }

      notify("success", form.id ? "Supplier updated." : "Supplier created.");
      setForm(null);
      setDuplicateWarning(null);
      router.refresh();
    });
  };

  const toggleActive = (supplier: SupplierRow) => {
    startTransition(async () => {
      const result = await setSupplierActive(supplier.id, !supplier.isActive);
      if (!result.ok) {
        notify("error", result.error);
        return;
      }
      notify("success", supplier.isActive ? "Supplier deactivated." : "Supplier restored.");
      router.refresh();
    });
  };

  const remove = (supplier: SupplierRow) => {
    startTransition(async () => {
      const result = await deleteSupplier(supplier.id);
      notify(result.ok ? "success" : "error", result.ok ? "Supplier deleted." : result.error);
      router.refresh();
    });
  };

  return (
    <div>
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Suppliers</h1>
          <p className="text-sm text-gray-500">
            {suppliers.length} supplier{suppliers.length === 1 ? "" : "s"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => openForm()}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
        >
          + New Supplier
        </button>
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, phone, address…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-gray-900 sm:max-w-xs"
        />
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          Show inactive
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[46rem] text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Supplier</th>
              <th className="px-4 py-2.5 font-medium">Phone</th>
              <th className="px-4 py-2.5 font-medium">Contact</th>
              <th className="px-4 py-2.5 font-medium">Address</th>
              <th className="px-4 py-2.5 text-right font-medium">Batches</th>
              <th className="px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">
                  No suppliers yet.
                </td>
              </tr>
            ) : (
              rows.map((supplier) => (
                <tr key={supplier.id} className={supplier.isActive ? "" : "bg-gray-50/60"}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{supplier.name}</span>
                      {!supplier.isActive && (
                        <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                          Inactive
                        </span>
                      )}
                    </div>
                    {supplier.notes && (
                      <p className="mt-0.5 truncate text-[11px] text-gray-400">{supplier.notes}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{supplier.phone ?? "—"}</td>
                  <td className="max-w-[12rem] truncate px-4 py-3 text-gray-600">
                    {supplier.contactLink ?? "—"}
                  </td>
                  <td className="max-w-[14rem] truncate px-4 py-3 text-gray-500">
                    {supplier.address ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{supplier.batchCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2 text-xs font-medium">
                      <button
                        type="button"
                        onClick={() => openForm(supplier)}
                        className="text-gray-600 transition hover:text-gray-900"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => toggleActive(supplier)}
                        className="text-gray-500 transition hover:text-gray-900 disabled:opacity-50"
                      >
                        {supplier.isActive ? "Deactivate" : "Restore"}
                      </button>
                      {supplier.batchCount === 0 && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => remove(supplier)}
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

      <Modal
        open={form !== null}
        onClose={() => setForm(null)}
        title={form?.id ? "Edit supplier" : "New supplier"}
        subtitle="Duplicates are checked by name and phone number."
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
              onClick={() => save(Boolean(duplicateWarning))}
              disabled={isPending || !form?.name.trim()}
              className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:bg-gray-300 ${
                duplicateWarning ? "bg-amber-600 hover:bg-amber-700" : "bg-gray-900 hover:bg-gray-800"
              }`}
            >
              {isPending ? "Saving…" : duplicateWarning ? "Save anyway" : "Save supplier"}
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

            {duplicateWarning && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <p className="font-medium">{duplicateWarning}</p>
                <p className="mt-0.5 text-xs">
                  Check the list before continuing. If this really is a different supplier, press
                  &ldquo;Save anyway&rdquo;.
                </p>
              </div>
            )}

            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-gray-600">Name</span>
              <input
                value={form.name}
                onChange={(e) => {
                  setForm({ ...form, name: e.target.value });
                  setDuplicateWarning(null);
                }}
                className={inputClass}
                placeholder="Supplier or shop name"
              />
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-gray-600">Phone</span>
                <input
                  value={form.phone}
                  onChange={(e) => {
                    setForm({ ...form, phone: e.target.value });
                    setDuplicateWarning(null);
                  }}
                  className={inputClass}
                  placeholder="09xxxxxxxxx"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-gray-600">
                  Social / contact link
                </span>
                <input
                  value={form.contactLink}
                  onChange={(e) => setForm({ ...form, contactLink: e.target.value })}
                  className={inputClass}
                  placeholder="Facebook, Telegram, Viber…"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-gray-600">Address</span>
              <textarea
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                rows={2}
                className={inputClass}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-gray-600">Notes</span>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className={inputClass}
                placeholder="Payment terms, lead time, reliability…"
              />
            </label>
          </div>
        )}
      </Modal>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm outline-none transition focus:border-gray-900";
