import { CurtainLink } from '@/components/layout/RouteCurtain';
import { ProductImage } from '@/components/product/ProductImage';
import { Icon } from '@/components/ui/Icon';
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

/** Each sport gets its own material world — turf, gym light, water, track, steel, court, terrain. */
const WORLD: Record<SportSlug, { cls: string; ink: string; curtain: string; curtainInk: string }> = {
  football: { cls: 'world-turf', ink: '#FFFFFF', curtain: '#5C9A33', curtainInk: '#FFFFFF' },
  boxing: { cls: 'world-gym', ink: '#171A18', curtain: '#EFE9DC', curtainInk: '#171A18' },
  swimming: { cls: 'world-water', ink: '#FFFFFF', curtain: '#2AA7B8', curtainInk: '#FFFFFF' },
  running: { cls: 'world-track', ink: '#FFFFFF', curtain: '#C8553A', curtainInk: '#FFFFFF' },
  fitness: { cls: 'world-steel', ink: '#171A18', curtain: '#D9DCD8', curtainInk: '#171A18' },
  basketball: { cls: 'world-court', ink: '#171A18', curtain: '#E3A867', curtainInk: '#171A18' },
  outdoor: { cls: 'world-terrain', ink: '#171A18', curtain: '#5E7D6A', curtainInk: '#FFFFFF' },
};

function Panel({ s, size, index }: { s: ShowcaseSport; size: 'xl' | 'lg' | 'sm'; index: number }) {
  const w = WORLD[s.slug];
  return (
    <CurtainLink
      href={`/${s.slug}`}
      color={w.curtain}
      ink={w.curtainInk}
      word={s.name}
      className={`world ${w.cls} group relative isolate block overflow-hidden rounded-[2px] [container-type:inline-size] ${
        size === 'xl' ? 'min-h-[118vw] md:min-h-0 md:row-span-2' : size === 'lg' ? 'min-h-[92vw] md:min-h-[44vh]' : 'min-h-[56vw] md:min-h-[34vh]'
      }`}
      aria-label={`${s.name} — ${s.count} products`}
    >
      <div aria-hidden className="world-fx absolute inset-0 -z-10" />
      {w.ink === '#FFFFFF' && <div aria-hidden className="world-scrim absolute inset-0 -z-[9]" />}
      <span
        aria-hidden
        className={`display absolute -z-[5] select-none whitespace-nowrap leading-[0.78] ${size === 'sm' ? 'bottom-3 left-3' : 'left-4 top-[16%]'}`}
        style={{
          color: w.ink,
          opacity: size === 'sm' ? 1 : 0.92,
          // fit the word to the panel width (container query units)
          fontSize: `${Math.min(size === 'sm' ? 24 : 27, (size === 'sm' ? 158 : 168) / s.name.length)}cqw`,
        }}
      >
        {s.name}
      </span>
      <div
        className={`absolute transition-transform duration-[900ms] ease-[var(--ease-expo)] group-hover:-translate-y-3 group-hover:rotate-[-2deg] ${
          size === 'sm' ? 'right-[-6%] top-[6%] h-[78%] w-[66%]' : 'inset-x-[6%] bottom-[12%] top-[30%]'
        }`}
        style={{ animation: `float-y ${5 + index}s ease-in-out infinite`, ['--r' as string]: size === 'sm' ? '-8deg' : '-3deg' }}
      >
        <ProductImage slug={s.hero.slug} colorId={s.hero.color} alt="" sizes={size === 'sm' ? '45vw' : '(max-width:768px) 90vw, 50vw'} className="drop-shadow-[0_30px_30px_rgba(0,0,0,0.25)]" />
      </div>
      {s.extra && size !== 'sm' && (
        <div className="world-roll absolute bottom-[6%] left-0 h-[16%] w-[16%]" aria-hidden>
          <ProductImage slug={s.extra.slug} colorId={s.extra.color} alt="" sizes="20vw" />
        </div>
      )}
      <div className={`absolute inset-x-0 bottom-0 flex items-end justify-between p-4 ${size === 'sm' ? 'top-0 flex-col items-start justify-start' : ''}`}>
        {size !== 'sm' && (
          <p className={`max-w-[18ch] text-[15px] font-medium ${w.ink === '#FFFFFF' ? 'on-light-world' : ''}`} style={{ color: w.ink }}>
            {s.tagline}
          </p>
        )}
        <span
          className={`mono inline-flex items-center gap-2 rounded-[2px] bg-white/90 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink backdrop-blur ${size === 'sm' ? '' : ''}`}
        >
          {s.count} products <Icon name="arrow-right" size={14} />
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
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="eyebrow text-muted">Shop by sport</p>
          <h2 id="sports-title" className="display mt-3 text-[clamp(44px,11vw,120px)]">
            Choose your arena
          </h2>
        </div>
        <p className="hidden max-w-xs text-[15px] text-muted md:block">Every sport has its own world. Step into one — the products are waiting inside.</p>
      </div>
      <div className="mt-10 grid gap-3 md:grid-cols-[1.25fr_1fr] md:grid-rows-2">
        {major.map((s, i) => (
          <Panel key={s.slug} s={s} size={i === 0 ? 'xl' : 'lg'} index={i} />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        {minor.map((s, i) => (
          <Panel key={s.slug} s={s} size="sm" index={i + 3} />
        ))}
      </div>
    </section>
  );
}
