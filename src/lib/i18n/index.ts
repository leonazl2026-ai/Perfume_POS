import { dictionaries, en, type TranslationKey } from "@/lib/i18n/dictionary";

export type Language = "en" | "mm";

export const LANGUAGES: { id: Language; label: string; short: string }[] = [
  { id: "en", label: "English", short: "EN" },
  { id: "mm", label: "မြန်မာ", short: "MM" },
];

export const DEFAULT_LANGUAGE: Language = "en";

/** Cookie name — mirrored from localStorage so server components can read it. */
export const LANGUAGE_COOKIE = "pos_lang";
export const LANGUAGE_STORAGE_KEY = "pos.language";

export const isLanguage = (value: unknown): value is Language =>
  value === "en" || value === "mm";

/**
 * Translate a key. Falls back to English, then to the key itself, so a gap in
 * the dictionary degrades to readable text rather than blanking the UI.
 */
export function translate(lang: Language, key: TranslationKey): string {
  return dictionaries[lang]?.[key] ?? en[key] ?? key;
}

/** Curried form for components that translate many keys. */
export function translator(lang: Language) {
  return (key: TranslationKey): string => translate(lang, key);
}

export type { TranslationKey };
