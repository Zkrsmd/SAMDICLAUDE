import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { renderUrl } from '@/lib/format';
import { categoryMedia } from '@/config/hero';
import type { SportSlug } from '@/types/catalog';

const GLOW: Partial<Record<SportSlug, string>> = {
  football: 'rgba(120,160,130,.5)',
  boxing: 'rgba(176,146,98,.5)',
  swimming: 'rgba(96,150,196,.5)',
  running: 'rgba(150,120,112,.5)',
  fitness: 'rgba(130,142,158,.5)',
  basketball: 'rgba(170,128,96,.5)',
};

/** Category header: the sport's campaign still, the word as architecture, the hero product floating. */
export function CategoryHero({
  sport,
  title,
  description,
  count,
  crumbs,
  hero,
  compact,
}: {
  sport: SportSlug;
  title: string;
  description: string;
  count: number;
  crumbs: { label: string; href?: string }[];
  hero?: { slug: string; color: string; name: string };
  compact?: boolean;
}) {
  const media = categoryMedia[sport];
  const glow = GLOW[sport] ?? 'rgba(255,255,255,.4)';
  const letters = title.toUpperCase().split('');
  return (
    <header className={`relative isolate overflow-hidden bg-[#07080A] text-white [container-type:inline-size] ${compact ? 'min-h-[62svh]' : 'min-h-[88svh]'} md:min-h-[78vh]`}>
      {media && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={media} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" style={{ animation: 'ken-burns 18s ease-out both' }} />
      )}
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(0,0,0,.55),transparent_30%,transparent_50%,rgba(0,0,0,.85))]" />
      <div aria-hidden className="absolute inset-0 -z-10" style={{ background: `radial-gradient(50% 40% at 65% 55%, ${glow}, transparent 70%)`, mixBlendMode: 'soft-light' }} />
      <div className="container-x relative flex h-full min-h-[inherit] flex-col pb-8" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 96px)' }}>
        <Breadcrumbs items={crumbs} light />
        <h1
          className="display relative z-0 mt-6 whitespace-nowrap leading-[0.8]"
          style={{ fontSize: `${Math.min(24, 96 / Math.max(4, title.length))}cqw`, filter: 'drop-shadow(0 10px 30px rgba(0,0,0,.35))' }}
          aria-label={title}
        >
          {letters.map((ch, i) => (
            <span key={i} aria-hidden className="inline-block" style={{ animation: `letter-slam .9s ${0.1 + i * 0.05}s cubic-bezier(.16,1,.3,1) both` }}>
              {ch === ' ' ? ' ' : ch}
            </span>
          ))}
        </h1>
        {hero && (
          <div
            className="pointer-events-none absolute inset-x-[6%] top-[32%] bottom-[26%] md:inset-x-auto md:bottom-[10%] md:right-[5%] md:top-[18%] md:w-[44%]"
            style={{ animation: 'product-in 1.5s .3s cubic-bezier(.16,1,.3,1) both' }}
          >
            <div className="float-wrap h-full w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={renderUrl(hero.slug)}
                alt={hero.name}
                className="float-product h-full w-full object-contain"
                style={{ filter: `drop-shadow(0 30px 50px ${glow}) drop-shadow(0 20px 20px rgba(0,0,0,.5))` }}
              />
            </div>
          </div>
        )}
        <div className="mt-auto flex flex-col gap-4 md:max-w-md">
          <p className="text-[18px] font-semibold leading-snug md:text-[21px]" style={{ animation: 'rise-in .8s .5s var(--ease-expo) both' }}>
            {description}
          </p>
          <p className="mono text-[12px] uppercase tracking-[0.16em] text-white/80">
            <span className="font-bold text-white">{count}</span> products
          </p>
        </div>
      </div>
    </header>
  );
}
