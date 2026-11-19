import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Card, PageHead, money } from '@/components/admin/ui';
import { categoryMedia } from '@/config/hero';
import { sports } from '@/data/categories';
import { requireAdmin } from '@/lib/admin/auth';
import { getAdminProducts } from '@/lib/catalog';

export const metadata: Metadata = { title: 'Collections' };

/** The store's structure: every sport and its categories, with what's in them. */
export default async function CollectionsPage() {
  await requireAdmin();
  const products = getAdminProducts();
  return (
    <div className="adm-page">
      <PageHead title="Collections" />
      <div className="grid gap-3 md:grid-cols-2">
        {sports.map((s) => {
          const list = products.filter((p) => p.sport === s.slug);
          const active = list.filter((p) => p.status === 'active');
          const value = list.reduce((n, p) => n + p.sizes.reduce((u, x) => u + (p.stock[x] ?? 0), 0) * p.price, 0);
          return (
            <Card key={s.slug} pad={false} className="overflow-hidden">
              <div className="relative h-28 bg-[#e8ebef]">
                {categoryMedia[s.slug] && <Image src={categoryMedia[s.slug]!} alt="" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between text-white">
                  <div>
                    <p className="display text-[26px] leading-none">{s.name}</p>
                    <p className="mt-1 text-[12px] text-white/80">
                      {active.length} active of {list.length} · {active.length ? 'shown in the store' : 'hidden (no active products)'}
                    </p>
                  </div>
                  <Link href={`/admin/products?sport=${s.slug}`} className="adm-btn adm-btn-sm !bg-white/90 !text-ink">
                    Products
                  </Link>
                </div>
              </div>
              <div className="flex items-center justify-between px-4 pt-3 text-[12.5px] text-[#66707c]">
                <span>{s.subs.length} categories</span>
                <span className="num">Stock value {money(value)}</span>
              </div>
              <ul className="p-2">
                {s.subs.map((x) => {
                  const n = list.filter((p) => p.sub === x.slug);
                  return (
                    <li key={x.slug}>
                      <Link href={`/admin/products?sport=${s.slug}&sub=${x.slug}`} className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-[#f5f6f8]">
                        <span className={n.length ? 'font-medium' : 'text-[#8a939e]'}>{x.name}</span>
                        <span className="num text-[12.5px] text-[#66707c]">{n.length}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
