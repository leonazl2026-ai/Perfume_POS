"use client";

import { useState, useTransition } from "react";
import { updateDelivery } from "@/actions/sales";
import { Modal } from "@/components/ui/Modal";
import { DELIVERY_LABELS, DELIVERY_ORDER } from "@/lib/delivery";
import type { DeliveryStatusValue, SaleRow } from "@/types/reports";

interface DeliveryDialogProps {
  sale: SaleRow | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function DeliveryDialog({ sale, onClose, onSaved }: DeliveryDialogProps) {
  const [status, setStatus] = useState<DeliveryStatusValue>(
    sale?.deliveryStatus ?? "NOT_REQUIRED"
  );
  const [courier, setCourier] = useState(sale?.courier ?? "");
  const [tracking, setTracking] = useState(sale?.trackingNumber ?? "");
  const [address, setAddress] = useState(sale?.deliveryAddress ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!sale) return null;

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateDelivery({
        saleId: sale.id,
        deliveryStatus: status,
        courier,
        trackingNumber: tracking,
        deliveryAddress: address,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      onSaved("Delivery updated.");
      onClose();
    });
  };

  return (
    <Modal
      open={Boolean(sale)}
      onClose={onClose}
      title={`Delivery — ${sale.saleNumber}`}
      subtitle={sale.customerName ?? "Walk-in customer"}
      widthClass="max-w-lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:bg-gray-300"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      {error && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="space-y-3">
        <div>
          <span className="mb-1.5 block text-[11px] font-medium text-gray-600">Status</span>
          <div className="flex flex-wrap gap-1.5">
            {DELIVERY_ORDER.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatus(value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  status === value
                    ? "bg-gray-900 text-white"
                    : "border border-gray-200 text-gray-600 hover:border-gray-900"
                }`}
              >
                {DELIVERY_LABELS[value]}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-gray-400">
            Shipped and Delivered stamp a timestamp the first time they are set.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-gray-600">Courier</span>
            <input
              value={courier}
              onChange={(e) => setCourier(e.target.value)}
              placeholder="J&T, DHL, Grab…"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-gray-600">
              Tracking number
            </span>
            <input
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              className={`${inputClass} font-mono`}
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-gray-600">
            Delivery address
          </span>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={2}
            className={inputClass}
          />
        </label>
      </div>
    </Modal>
  );
}

const inputClass =
  "w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm outline-none transition focus:border-gray-900";
