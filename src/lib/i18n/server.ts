import { cookies } from "next/headers";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_COOKIE,
  isLanguage,
  translator,
  type Language,
} from "@/lib/i18n";

/**
 * Server-side language resolution.
 *
 * The switcher writes both localStorage (as specified) and a cookie; the
 * cookie is what makes server-rendered pages and printed receipts respect the
 * choice, since localStorage is invisible during SSR.
 */
export async function getLanguage(): Promise<Language> {
  const store = await cookies();
  const value = store.get(LANGUAGE_COOKIE)?.value;
  return isLanguage(value) ? value : DEFAULT_LANGUAGE;
}

/** Convenience: resolve the language and return a bound translator. */
export async function getTranslator() {
  const lang = await getLanguage();
  return { lang, t: translator(lang) };
}
