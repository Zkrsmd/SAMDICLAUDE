import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, LANG_COOKIE, isLocale, makeT, type Locale } from './config';
import { DICTS } from './dictionaries';

/** The visitor's language (cookie), and whether they have chosen one yet. */
export const getLocaleInfo = cache(async (): Promise<{ locale: Locale; chosen: boolean }> => {
  const v = (await cookies()).get(LANG_COOKIE)?.value;
  return isLocale(v) ? { locale: v, chosen: true } : { locale: DEFAULT_LOCALE, chosen: false };
});
export const getLocale = async () => (await getLocaleInfo()).locale;
/** Translator for server components: `const t = await getT()`. */
export const getT = async () => makeT(DICTS[await getLocale()]);
