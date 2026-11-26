'use client';
import { useEffect, useRef } from 'react';
import { chooseLanguage } from '@/i18n/client';
import { LANGUAGE_NAMES, LOCALES } from '@/i18n/config';
import { HeaderMark } from '@/components/header/HeaderMark';

/**
 * First visit: the store asks for a language before anything else plays (the hero films wait for it).
 * The choice is kept for a year; the page then opens in that language, intro included.
 */
export function LanguageGate() {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    first.current?.focus();
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prev;
    };
  }, []);
  return (
    <div className="lang-gate" role="dialog" aria-modal="true" aria-labelledby="lang-gate-title">
      <div className="lang-gate-card">
        <p dir="ltr" style={{ ['--sh-ink' as string]: '#0b1b3f' }}>
          <span className="sr-only">STRYKE</span>
          <HeaderMark className="lang-gate-mark" />
        </p>
        <h2 id="lang-gate-title" className="mt-5 text-[15px] text-muted">
          <span lang="en">Choose your language</span>
          <span aria-hidden> · </span>
          <span lang="fr">Choisissez votre langue</span>
          <span aria-hidden> · </span>
          <span lang="ar" dir="rtl">
            اختر لغتك
          </span>
        </h2>
        <div className="mt-6 grid gap-3">
          {LOCALES.map((l, i) => (
            <button
              key={l}
              ref={i === 0 ? first : undefined}
              type="button"
              lang={l}
              dir={l === 'ar' ? 'rtl' : 'ltr'}
              className="lang-gate-option"
              onClick={() => chooseLanguage(l)}
              data-testid={`lang-${l}`}
            >
              <span>{LANGUAGE_NAMES[l].native}</span>
              <span className="mono text-[12px] opacity-60">{l.toUpperCase()}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
