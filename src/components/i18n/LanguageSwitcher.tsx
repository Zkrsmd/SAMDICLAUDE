'use client';
import { chooseLanguage, useLocale, useT } from '@/i18n/client';
import { LANGUAGE_NAMES, LOCALES } from '@/i18n/config';

/** EN · FR · ع — switches the whole store (kept for a year). */
export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const locale = useLocale();
  const t = useT();
  return (
    <div role="group" aria-label={t('Language')} className={`lang-switch ${className}`} dir="ltr">
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={l === locale}
          aria-label={LANGUAGE_NAMES[l].native}
          onClick={() => l !== locale && chooseLanguage(l)}
          className="lang-switch-btn"
        >
          {LANGUAGE_NAMES[l].short}
        </button>
      ))}
    </div>
  );
}
