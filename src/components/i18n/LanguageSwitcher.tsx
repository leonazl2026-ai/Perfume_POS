"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import { LANGUAGES } from "@/lib/i18n";

/**
 * EN / မြန်မာ toggle. Refreshes after switching so server-rendered text
 * (page headings, receipts) re-renders in the new language too.
 */
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useI18n();
  const router = useRouter();

  return (
    <div
      role="group"
      aria-label="Language"
      className="flex shrink-0 gap-0.5 rounded-lg bg-gray-200/70 p-0.5"
    >
      {LANGUAGES.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={lang === option.id}
          onClick={() => {
            if (option.id === lang) return;
            setLang(option.id);
            router.refresh();
          }}
          title={option.label}
          className={`rounded-md px-2 py-1 text-xs font-medium transition ${
            lang === option.id
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          {compact ? option.short : option.label}
        </button>
      ))}
    </div>
  );
}
