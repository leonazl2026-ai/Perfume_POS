"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_COOKIE,
  LANGUAGE_STORAGE_KEY,
  isLanguage,
  translate,
  type Language,
  type TranslationKey,
} from "@/lib/i18n";

interface I18nContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/** One year, so the choice survives browser restarts on a shop terminal. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function persist(lang: Language) {
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  // Mirrored to a cookie so server components and receipts see the same value.
  document.cookie = `${LANGUAGE_COOKIE}=${lang}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
}

/**
 * `initialLang` comes from the cookie during SSR, so the first paint already
 * matches the user's choice and there is no flash of English.
 */
export function I18nProvider({
  initialLang = DEFAULT_LANGUAGE,
  children,
}: {
  initialLang?: Language;
  children: React.ReactNode;
}) {
  const [lang, setLangState] = useState<Language>(initialLang);

  // localStorage is the spec'd store; reconcile it after mount in case the
  // cookie was cleared independently.
  useEffect(() => {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isLanguage(stored) && stored !== lang) {
      setLangState(stored);
      persist(stored);
    } else {
      persist(lang);
    }
    // Intentionally mount-only: this reconciles the initial value, and later
    // changes go through setLang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    persist(next);
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({ lang, setLang, t: (key: TranslationKey) => translate(lang, key) }),
    [lang, setLang]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside <I18nProvider>");
  }
  return context;
}
