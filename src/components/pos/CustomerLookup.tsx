"use client";

import { useEffect, useRef, useState } from "react";
import { lookupCustomers } from "@/actions/customers";
import { CHANNEL_SHORT } from "@/lib/channels";
import { TIER_LABELS, TIER_STYLES } from "@/lib/tiers";
import type { CustomerSuggestion } from "@/types/crm";

interface CustomerLookupProps {
  label: string;
  value: string;
  placeholder?: string;
  type?: "text" | "tel";
  disabled?: boolean;
  onChange: (value: string) => void;
  onPick: (customer: CustomerSuggestion) => void;
}

/**
 * Text input with a debounced CRM type-ahead. Matches on name or phone
 * digits; picking a result fills the rest of the customer's details.
 */
export function CustomerLookup({
  label,
  value,
  placeholder,
  type = "text",
  disabled,
  onChange,
  onPick,
}: CustomerLookupProps) {
  const [suggestions, setSuggestions] = useState<CustomerSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  // Guards against a slow request overwriting a newer one.
  const requestId = useRef(0);

  useEffect(() => {
    const term = value.trim();
    if (term.length < 2) {
      setSuggestions([]);
      return;
    }

    const current = ++requestId.current;
    const timer = setTimeout(() => {
      lookupCustomers(term)
        .then((results) => {
          if (requestId.current === current) setSuggestions(results);
        })
        .catch(() => {
          if (requestId.current === current) setSuggestions([]);
        });
    }, 250);

    return () => clearTimeout(timer);
  }, [value]);

  // Close the dropdown when focus moves elsewhere on the page.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const visible = open && suggestions.length > 0;

  return (
    <div ref={containerRef} className="relative">
      <label className="block">
        <span className="mb-1 block text-[11px] font-medium text-gray-500">{label}</span>
        <input
          type={type}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm outline-none focus:border-gray-900 disabled:bg-gray-50"
        />
      </label>

      {visible && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {suggestions.map((customer) => (
            <li key={customer.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(customer);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition hover:bg-gray-50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm text-gray-900">
                    {customer.name ?? "Unnamed"}
                  </span>
                  <span className="block truncate text-[11px] text-gray-400">
                    {customer.phone ?? "No phone"} · {customer.totalOrders} order
                    {customer.totalOrders === 1 ? "" : "s"} · {CHANNEL_SHORT[customer.channel]}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${TIER_STYLES[customer.tier]}`}
                >
                  {TIER_LABELS[customer.tier]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
