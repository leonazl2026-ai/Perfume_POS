"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { RANGE_PRESETS, type RangePreset } from "@/lib/dateRange";

/**
 * Filters live in the URL so every admin list stays server-rendered,
 * shareable, and back-button friendly.
 */
export function useFilterParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return useCallback(
    (patch: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(patch)) {
        if (!value) params.delete(key);
        else params.set(key, value);
      }

      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [router, pathname, searchParams]
  );
}

export function DateRangeFilter({ preset }: { preset: RangePreset }) {
  const searchParams = useSearchParams();
  const setParams = useFilterParams();

  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1 rounded-lg bg-gray-200/70 p-1">
        {RANGE_PRESETS.map((option) => (
          <button
            key={option.id}
            type="button"
            // Selecting a preset clears any custom range.
            onClick={() =>
              setParams({ preset: option.id, from: undefined, to: undefined })
            }
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
              preset === option.id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1 text-xs text-gray-500">
        <input
          type="date"
          value={from}
          onChange={(e) => setParams({ from: e.target.value, preset: undefined })}
          className="rounded-md border border-gray-300 px-2 py-1 text-xs outline-none focus:border-gray-900"
        />
        <span>→</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setParams({ to: e.target.value, preset: undefined })}
          className="rounded-md border border-gray-300 px-2 py-1 text-xs outline-none focus:border-gray-900"
        />
        {(from || to) && (
          <button
            type="button"
            onClick={() => setParams({ from: undefined, to: undefined, preset: "30d" })}
            className="ml-1 text-gray-400 transition hover:text-gray-900"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
