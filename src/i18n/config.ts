/**
 * Languages of the storefront. The visitor's choice lives in the `lang` cookie (set by the language
 * picker shown on the first visit, and by the switcher in the header / menu / footer). Text is written
 * in English in the code — `t('Add to bag')` — and translated through src/i18n/fr.ts and ar.ts (keyed
 * by the English text; anything missing falls back to English). The admin stays in English.
 */
export const LOCALES = ['en', 'fr', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
export const LANG_COOKIE = 'lang';
export const isLocale = (v: unknown): v is Locale => typeof v === 'string' && (LOCALES as readonly string[]).includes(v);
export const dirOf = (l: Locale) => (l === 'ar' ? 'rtl' : 'ltr');
/** How each language names itself (the picker and switcher). */
export const LANGUAGE_NAMES: Record<Locale, { native: string; short: string }> = {
  en: { native: 'English', short: 'EN' },
  fr: { native: 'Français', short: 'FR' },
  ar: { native: 'العربية', short: 'ع' },
};

export type Dict = Record<string, string>;
export type TFunction = (text: string, vars?: Record<string, string | number>) => string;

/** A translator for one dictionary: looks the English text up, then fills {placeholders}. */
export function makeT(dict: Dict): TFunction {
  return (text, vars) => {
    let out = dict[text] ?? text;
    if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
    return out;
  };
}
