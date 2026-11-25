'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Wordmark } from '@/components/ui/Wordmark';
import { useUi } from '@/stores/ui';
import { useDialog } from '@/hooks/useDialog';
import type { NavSport } from './Header';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';
import { useT } from '@/i18n/client';

const ACCENT: Record<string, string> = {
  football: '#89C94A',
  boxing: '#C8A451',
  swimming: '#64D7D1',
  running: '#F36A32',
  fitness: '#8E9590',
  basketball: '#E07A2E',
  outdoor: '#5E7D6A',
};

export function MobileMenu({ nav }: { nav: NavSport[] }) {
  const t = useT();
  const { menuOpen, set } = useUi();
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const close = () => set({ menuOpen: false });
  useDialog(ref, menuOpen, close);

  useEffect(() => {
    set({ menuOpen: false });
  }, [pathname, set]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={t('Menu')}
      aria-hidden={!menuOpen}
      inert={!menuOpen}
      className={`fixed inset-0 z-[60] flex flex-col bg-bg transition-[clip-path] duration-700 ease-[var(--ease-expo)] lg:hidden ${
        menuOpen ? '[clip-path:inset(0_0_0_0)]' : '[clip-path:inset(0_0_100%_0)]'
      }`}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="container-x flex h-14 items-center">
        <span>
          <Wordmark className="h-8" />
        </span>
        <LanguageSwitcher className="ms-auto" />
        <button type="button" className="-me-2 ms-2 grid h-11 w-11 place-items-center" aria-label={t('Close menu')} onClick={close}>
          <Icon name="close" />
        </button>
      </div>
      <nav aria-label={t('Sports')} className="container-x flex-1 overflow-y-auto pb-10 pt-4">
        <ul>
          {nav.map((s, i) => (
            <li key={s.slug} className="border-b border-line">
              <div className="flex items-center">
                <Link
                  href={`/${s.slug}`}
                  className="display flex flex-1 items-center gap-3 py-3 text-[clamp(34px,9.5vw,50px)]"
                  style={{ transitionDelay: menuOpen ? `${80 + i * 40}ms` : '0ms' }}
                >
                  <span className="h-3 w-3 rounded-full" style={{ background: ACCENT[s.slug] }} aria-hidden />
                  {s.name}
                </Link>
                <button
                  type="button"
                  className="grid h-12 w-12 place-items-center"
                  aria-expanded={expanded === s.slug}
                  aria-label={t('{name} categories', { name: s.name })}
                  onClick={() => setExpanded((e) => (e === s.slug ? null : s.slug))}
                >
                  <Icon name="chevron-down" className={`transition-transform ${expanded === s.slug ? 'rotate-180' : ''}`} />
                </button>
              </div>
              {expanded === s.slug && (
                <ul className="grid grid-cols-2 gap-x-4 pb-4">
                  {s.subs.map((x) => (
                    <li key={x.slug}>
                      <Link href={`/${s.slug}/${x.slug}`} className="block py-2 text-[15px] text-ink-2">
                        {x.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-8 grid grid-cols-2 gap-3">
          <Link href="/wishlist" className="btn btn-line">
            {t('Wishlist')}
          </Link>
          <Link href="/cart" className="btn btn-ink">
            {t('Bag')}
          </Link>
        </div>
      </nav>
    </div>
  );
}
