import { CurtainLink } from '@/components/layout/RouteCurtain';
import { Icon } from '@/components/ui/Icon';
import { renderUrl } from '@/lib/format';
import type { SportSlug } from '@/types/catalog';
import { ArenaArt } from './ArenaArt';

export interface ShowcaseSport {
  slug: SportSlug;
  name: string;
  tagline: string;
  accent: string;
  count: number;
  hero: { slug: string; color: string };
  extra?: { slug: string; color: string };
}

const CURTAIN: Record<SportSlug, string> = {
  football: '#1F3A12',
  boxing: '#14110B',
  swimming: '#06303A',
  running: '#2A1410',
  fitness: '#16181B',
  basketball: '#2B1708',
  outdoor: '#1B2A22',
};
function Panel({ s, size, index }: { s: ShowcaseSport; size: 'xl' | 'lg' | 'sm'; index: number }) {
  const fs = `${Math.min(size === 'sm' ? 24 : 22, (size === 'sm' ? 86 : 92) / s.name.length)}cqw`;
  const pos = size === 'sm' ? 'left-4 top-4' : 'left-5 top-5';
  return (
    <CurtainLink
      href={`/${s.slug}`}
      color={CURTAIN[s.slug]}
      ink="#FFFFFF"
      word={s.name}
      className={`arena group block [container-type:inline-size] ${
        size === 'xl' ? 'min-h-[120vw] md:row-span-2 md:min-h-0' : size === 'lg' ? 'min-h-[92vw] md:min-h-[46vh]' : 'min-h-[70vw] md:min-h-[42vh]'
      }`}
      aria-label={`${s.name} — ${s.count} products`}
      data-reveal=""
      data-light=""
      style={{ ['--d' as string]: `${index * 90}ms` }}
    >
      <ArenaArt sport={s.slug} />
      <span aria-hidden className={`display arena-word ${pos}`} style={{ fontSize: fs }}>
        {s.name}
      </span>

      <div className={`arena-product absolute ${size === 'sm' ? 'inset-x-[12%] bottom-[20%] top-[30%]' : 'inset-x-[10%] bottom-[18%] top-[26%]'}`}>
        <span aria-hidden className="arena-shadow" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={renderUrl(s.hero.slug)} alt="" loading="lazy" decoding="async" className="relative h-full w-full object-contain" />
      </div>

      <div className="arena-copy absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 md:p-5">
        {size !== 'sm' ? <p className="max-w-[20ch] text-[16px] font-semibold leading-tight tracking-[-0.01em] md:text-[18px]">{s.tagline}</p> : <span />}
        <span className="arena-chip mono inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-[10.5px] font-semibold uppercase tracking-[0.14em]">
          {s.count} <span className="hidden sm:inline">products</span> <Icon name="arrow-right" size={14} className="arena-arrow" />
        </span>
      </div>
    </CurtainLink>
  );
}

export function CategoryShowcase({ sports }: { sports: ShowcaseSport[] }) {
  const major = sports.slice(0, 3);
  const minor = sports.slice(3);
  return (
    <section aria-labelledby="sports-title" className="container-x py-16 md:py-24">
      <div className="flex items-end justify-between gap-6" data-reveal>
        <div>
          <p className="eyebrow text-muted">Shop by sport</p>
          <h2 id="sports-title" className="display mt-3 text-[clamp(36px,9.4vw,128px)]">
            Choose your <span className="holo-text">arena</span>
          </h2>
        </div>
        <p className="hidden max-w-xs text-[15px] text-muted md:block">Every sport has its own field of play. Pick yours.</p>
      </div>
      <div className="mt-10 grid gap-3 md:grid-cols-[1.25fr_1fr] md:grid-rows-2">
        {major.map((s, i) => (
          <Panel key={s.slug} s={s} size={i === 0 ? 'xl' : 'lg'} index={i} />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
        {minor.map((s, i) => (
          <Panel key={s.slug} s={s} size="sm" index={i + 3} />
        ))}
      </div>
    </section>
  );
}
