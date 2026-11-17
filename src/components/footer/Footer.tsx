import Link from 'next/link';
import { brand } from '@/config/brand';
import { Wordmark } from '@/components/ui/Wordmark';
import type { NavSport } from '@/components/header/Header';

export function Footer({ nav }: { nav: NavSport[] }) {
  return (
    <footer className="relative mt-24 overflow-hidden border-t border-line bg-stone">
      <div className="container-x grid gap-12 py-16 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <div className="text-[34px]">
            <Wordmark />
          </div>
          <p className="mt-4 max-w-sm text-[15px] text-muted">{brand.description}</p>
          <p className="eyebrow mt-6 text-muted">Demonstration store — no payments are taken.</p>
        </div>
        <FooterCol title="Sports">
          {nav.map((s) => (
            <li key={s.slug}>
              <Link href={`/${s.slug}`} className="hover:text-orange">
                {s.name}
              </Link>
            </li>
          ))}
        </FooterCol>
        <FooterCol title="Shop">
          <li><Link href="/search" className="hover:text-orange">Search</Link></li>
          <li><Link href="/wishlist" className="hover:text-orange">Wishlist</Link></li>
          <li><Link href="/cart" className="hover:text-orange">Bag</Link></li>
          <li><span className="text-muted">Delivery info (placeholder)</span></li>
          <li><span className="text-muted">Returns (placeholder)</span></li>
        </FooterCol>
        <FooterCol title="Contact">
          <li className="text-muted">{brand.contact.email}</li>
          <li className="text-muted">{brand.contact.phone}</li>
          {brand.social.map((s) => (
            <li key={s.label}>
              <a href={s.href} target="_blank" rel="noopener noreferrer" className="hover:text-orange">
                {s.label}
              </a>
            </li>
          ))}
        </FooterCol>
      </div>
      <div className="container-x pb-6">
        <div className="hairline" />
        <div className="flex flex-col gap-2 py-5 text-[12px] text-muted md:flex-row md:justify-between">
          <span>© {new Date().getFullYear()} {brand.name}. Brand names belong to their owners; listed brands are not partners.</span>
          <span>Product photos are the brands’ official images, shown for demonstration.</span>
        </div>
      </div>
      <div aria-hidden className="display pointer-events-none select-none whitespace-nowrap px-2 pb-2 text-[22vw] leading-[0.75] text-ink/[0.04]">
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
