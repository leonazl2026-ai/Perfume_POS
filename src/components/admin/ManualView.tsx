"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { MANUAL_SECTIONS, pick, type ManualSection } from "@/lib/manual";

/**
 * Searchable, printable manual. Content lives in lib/manual.ts as data, so
 * filtering and language switching need no duplicated markup.
 */
export function ManualView() {
  const { lang, t } = useI18n();
  const [query, setQuery] = useState("");

  const search = query.trim().toLowerCase();

  /** A section survives if its title, summary, or any step matches. */
  const sections = useMemo<ManualSection[]>(() => {
    if (!search) return MANUAL_SECTIONS;

    return MANUAL_SECTIONS.map((section) => {
      const sectionMatches =
        pick(section.title, lang).toLowerCase().includes(search) ||
        pick(section.summary, lang).toLowerCase().includes(search);

      // Keep every topic when the section title matches; otherwise filter.
      const topics = sectionMatches
        ? section.topics
        : section.topics.filter((topic) => {
            const haystack = [
              pick(topic.heading, lang),
              ...topic.steps.map((step) => pick(step, lang)),
              topic.note ? pick(topic.note, lang) : "",
            ]
              .join(" ")
              .toLowerCase();
            return haystack.includes(search);
          });

      return { ...section, topics };
    }).filter((section) => section.topics.length > 0);
  }, [search, lang]);

  return (
    <div>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{t("manual.title")}</h1>
          <p className="text-sm text-gray-500">{t("manual.subtitle")}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("manual.search")}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-gray-900 sm:w-64"
          />
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 transition hover:border-gray-900 hover:text-gray-900"
          >
            {t("manual.print")}
          </button>
        </div>
      </header>

      {/* Print header — the toolbar above is hidden on paper. */}
      <div className="mb-4 hidden print:block">
        <h1 className="text-xl font-bold">{t("manual.title")}</h1>
        <p className="text-sm">Perfume &amp; Decant POS</p>
      </div>

      {sections.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
          {t("manual.noResults")}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
          {/* Contents */}
          <nav className="print:hidden">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {t("manual.contents")}
            </p>
            <ul className="space-y-1">
              {sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="block rounded-lg px-2.5 py-1.5 text-sm text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
                  >
                    {pick(section.title, lang)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="min-w-0 space-y-5">
            {sections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                className="scroll-mt-4 rounded-xl border border-gray-200 bg-white p-5 print:break-inside-avoid print:border-0 print:p-0"
              >
                <header className="mb-3">
                  <h2 className="text-base font-semibold text-gray-900">
                    {pick(section.title, lang)}
                  </h2>
                  <p className="mt-0.5 text-sm text-gray-500">{pick(section.summary, lang)}</p>
                </header>

                <div className="space-y-4">
                  {section.topics.map((topic, index) => (
                    <article key={index}>
                      <h3 className="mb-1.5 text-sm font-semibold text-gray-800">
                        {pick(topic.heading, lang)}
                      </h3>

                      <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-600 marker:text-gray-400">
                        {topic.steps.map((step, stepIndex) => (
                          <li key={stepIndex}>{pick(step, lang)}</li>
                        ))}
                      </ol>

                      {topic.note && (
                        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                          {pick(topic.note, lang)}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @media print {
          @page { margin: 14mm; }
        }
      `}</style>
    </div>
  );
}
