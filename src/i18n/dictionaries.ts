import type { Dict, Locale } from './config';
import { ar } from './ar';
import { fr } from './fr';

/** The translations, keyed by the English text. English needs none. */
export const DICTS: Record<Locale, Dict> = { en: {}, fr, ar };
