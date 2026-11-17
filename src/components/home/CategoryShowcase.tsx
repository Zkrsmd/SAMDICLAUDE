import { CurtainLink } from '@/components/layout/RouteCurtain';
import { Icon } from '@/components/ui/Icon';
import { renderUrl } from '@/lib/format';
import { categoryMedia } from '@/config/hero';
import type { SportSlug } from '@/types/catalog';

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
const GLOW: Partial<Record<SportSlug, string>> = {
  football: 'rgba(255,106,43,.55)',
  boxing: 'rgba(231,184,90,.6)',
  swimming: 'rgba(94,231,223,.55)',
  running: 'rgba(255,90,60,.5)',
  fitness: 'rgba(170,180,200,.5)',
  basketball: 'rgba(255,150,60,.5)',
};

function Panel({ s, size, index }: { s: ShowcaseSport; size: 'xl' | 'lg' | 'sm'; index: number }) {
  const media = categoryMedia[s.slug];
  const glow = GLOW[s.slug] ?? 'rgba(255,255,255,.4)';
  return (
    <CurtainLink
      href={`/${s.slug}`}
      color={CURTAIN[s.slug]}
      ink="#FFFFFF"
      word={s.name}
      className={`group relative isolate block overflow-hidden rounded-[22px] bg-ink text-white [container-type:inline-size] ${
        size === 'xl' ? 'min-h-[120vw] md:row-span-2 md:min-h-0' : size === 'lg' ? 'min-h-[92vw] md:min-h-[46vh]' : 'min-h-[70vw] md:min-h-[42vh]'
      }`}
      aria-label={`${s.name} — ${s.count} products`}
      data-reveal=""
      style={{ ['--d' as string]: `${index * 90}ms` }}
    >
      {media && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={media}
          alt=""
          loading="lazy"
          className="absolute inset-0 -z-20 h-full w-full scale-105 object-cover transition-transform duration-[1600ms] ease-[var(--ease-expo)] group-hover:scale-[1.15]"
        />
      )}
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(0,0,0,.45),transparent_35%,transparent_55%,rgba(0,0,0,.8))]" />
      <div aria-hidden className="absolute inset-0 -z-10 opacity-0 transition-opacity duration-700 group-hover:opacity-100" style={{ background: `radial-gradient(60% 50% at 50% 60%, ${glow}, transparent 70%)`, mixBlendMode: 'screen' }} />
      {/* animated holo edge on hover */}
      <span aria-hidden className="holo-ring opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

      <span
        aria-hidden
        className={`display absolute select-none whitespace-nowrap leading-[0.8] ${size === 'sm' ? 'left-4 top-4' : 'left-5 top-5'}`}
        style={{ fontSize: `${Math.min(size === 'sm' ? 24 : 22, (size === 'sm' ? 86 : 92) / s.name.length)}cqw`, textShadow: '0 10px 40px rgba(0,0,0,.35)' }}
      >
        {s.name}
      </span>

      <div
        className={`absolute transition-transform duration-[900ms] ease-[var(--ease-expo)] group-hover:-translate-y-4 group-hover:scale-110 group-hover:rotate-[-4deg] ${
          size === 'sm' ? 'inset-x-[12%] bottom-[20%] top-[30%]' : 'inset-x-[12%] bottom-[18%] top-[28%]'
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={renderUrl(s.hero.slug)}
          alt=""
          loading="lazy"
          className="h-full w-full object-contain"
          style={{ animation: `float-y ${5 + index}s ease-in-out infinite`, filter: `drop-shadow(0 30px 40px ${glow}) drop-shadow(0 18px 18px rgba(0,0,0,.5))` }}
        />
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 md:p-5">
        {size !== 'sm' ? <p className="max-w-[20ch] text-[16px] font-semibold leading-tight md:text-[18px]">{s.tagline}</p> : <span />}
        <span className="mono inline-flex shrink-0 items-center gap-2 rounded-full border border-white/40 bg-white/15 px-3.5 py-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] backdrop-blur-md transition-colors group-hover:bg-white group-hover:text-ink">
          {s.count} <span className="hidden sm:inline">products</span> <Icon name="arrow-right" size={14} />
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
        <p className="hidden max-w-xs text-[15px] text-muted md:block">Every sport has its own world. Step into one — the products are waiting inside.</p>
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
