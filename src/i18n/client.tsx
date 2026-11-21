'use client';
import { createContext, useContext, useMemo } from 'react';
import { DEFAULT_LOCALE, LANG_COOKIE, makeT, type Dict, type Locale, type TFunction } from './config';

const Ctx = createContext<{ locale: Locale; t: TFunction }>({ locale: DEFAULT_LOCALE, t: makeT({}) });

/** Gives client components the visitor's language (the dictionary of that language only). */
export function I18nProvider({ locale, dict, children }: { locale: Locale; dict: Dict; children: React.ReactNode }) {
  const value = useMemo(() => ({ locale, t: makeT(dict) }), [locale, dict]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useT = () => useContext(Ctx).t;
export const useLocale = () => useContext(Ctx).locale;

/** Remember the language for a year and show the page again in it. */
export function chooseLanguage(l: Locale) {
  document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax${location.protocol === 'https:' ? '; secure' : ''}`;
  window.location.reload();
}
