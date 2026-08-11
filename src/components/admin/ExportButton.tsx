"use client";

import { useSearchParams } from "next/navigation";

/**
 * Links to a CSV route carrying the page's current filters, so the export
 * always matches exactly what is on screen.
 */
export function ExportButton({
  endpoint,
  label = "Export CSV",
  extraParams,
}: {
  endpoint: string;
  label?: string;
  extraParams?: Record<string, string>;
}) {
  const searchParams = useSearchParams();

  const params = new URLSearchParams(searchParams.toString());
  for (const [key, value] of Object.entries(extraParams ?? {})) {
    params.set(key, value);
  }

  const query = params.toString();

  return (
    <a
      href={query ? `${endpoint}?${query}` : endpoint}
      // Plain navigation, not a fetch — the browser handles the download.
      download
      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:border-gray-900 hover:text-gray-900"
    >
      {label}
    </a>
  );
}
