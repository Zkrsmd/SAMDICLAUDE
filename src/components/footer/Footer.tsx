import Link from 'next/link';
import { brand } from '@/config/brand';
import { Wordmark } from '@/components/ui/Wordmark';
import type { NavSport } from '@/components/header/Header';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';
import { getT } from '@/i18n/server';

export async function Footer({ nav }: { nav: NavSport[] }) {
  const t = await getT();
  return (
    <footer className="relative mt-24 overflow-hidden border-t border-line bg-stone">
      <div className="container-x grid gap-12 py-16 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <div className="text-[34px]">
            <Wordmark />
          </div>
          <p className="mt-4 max-w-sm text-[15px] text-muted">{t(brand.description)}</p>
          <p className="eyebrow mt-6 text-muted">{t('Cash on delivery · all of Algeria')}</p>
          <LanguageSwitcher className="mt-5" />
        </div>
        <FooterCol title={t('Sports')}>
          {nav.map((s) => (
            <li key={s.slug}>
              <Link href={`/${s.slug}`} className="hover:text-cobalt">
                {s.name}
              </Link>
            </li>
          ))}
        </FooterCol>
        <FooterCol title={t('Shop')}>
          <li><Link href="/search" className="hover:text-cobalt">{t('Search')}</Link></li>
          <li><Link href="/wishlist" className="hover:text-cobalt">{t('Wishlist')}</Link></li>
          <li><Link href="/cart" className="hover:text-cobalt">{t('Bag')}</Link></li>
          <li><span className="text-muted">{t('Delivery to all 58 wilayas with ZR Express')}</span></li>
          <li><span className="text-muted">{t('Pay in cash when it arrives')}</span></li>
        </FooterCol>
        <FooterCol title={t('Contact')}>
          <li className="text-muted">{brand.contact.email}</li>
          <li className="text-muted mono">{brand.contact.phone}</li>
          {brand.social.map((s) => (
            <li key={s.label}>
              <a href={s.href} target="_blank" rel="noopener noreferrer" className="hover:text-cobalt">
                {s.label}
              </a>
            </li>
          ))}
        </FooterCol>
      </div>
      <div className="container-x pb-6">
        <div className="hairline" />
        <div className="flex flex-col gap-2 py-5 text-[12px] text-muted md:flex-row md:justify-between">
          <span>
            © {new Date().getFullYear()} {brand.name}. {t('Brand names belong to their owners; listed brands are not partners.')}
          </span>
          <span>{t('Photos show the product type; the item you receive may differ slightly.')}</span>
        </div>
      </div>
      <div aria-hidden className="display pointer-events-none select-none whitespace-nowrap px-2 pb-2 text-[22vw] leading-[0.75] text-ink/[0.04]" dir="ltr">
        {brand.name}
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="eyebrow text-muted">{title}</h2>
      <ul className="mt-4 space-y-2 text-[15px]">{children}</ul>
    </div>
  );
}
