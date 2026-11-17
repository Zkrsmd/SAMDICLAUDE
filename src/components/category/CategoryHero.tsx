import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { ProductImage } from '@/components/product/ProductImage';
import type { SportSlug } from '@/types/catalog';

const WORLD: Record<SportSlug, { cls: string; ink: string }> = {
  football: { cls: 'world-turf', ink: '#FFFFFF' },
  boxing: { cls: 'world-gym', ink: '#171A18' },
  swimming: { cls: 'world-water', ink: '#FFFFFF' },
  running: { cls: 'world-track', ink: '#FFFFFF' },
  fitness: { cls: 'world-steel', ink: '#171A18' },
  basketball: { cls: 'world-court', ink: '#171A18' },
  outdoor: { cls: 'world-terrain', ink: '#171A18' },
};

/** Category header: the sport's material world, the word as architecture, the hero object. */
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
  const w = WORLD[sport];
  const light = w.ink === '#FFFFFF';
  const letters = title.toUpperCase().split('');
  return (
    <header
      className={`world ${w.cls} relative isolate overflow-hidden [container-type:inline-size] ${compact ? 'min-h-[62svh]' : 'min-h-[86svh]'} md:min-h-[72vh]`}
    >
      <div aria-hidden className="world-fx absolute inset-0 -z-10" />
      {light && <div aria-hidden className="world-scrim absolute inset-0 -z-[9]" />}
      <div
        className={`container-x relative flex h-full min-h-[inherit] flex-col pb-8 ${light ? 'on-light-world' : ''}`}
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 80px)' }}
      >
        <Breadcrumbs items={crumbs} light={light} />
        <h1
          className="display relative z-0 mt-6 whitespace-nowrap leading-[0.8]"
          style={{ color: w.ink, fontSize: `${Math.min(30, 172 / Math.max(5, title.length))}cqw` }}
          aria-label={title}
        >
          {letters.map((ch, i) => (
            <span
              key={i}
              aria-hidden
              className="inline-block"
              style={{ animation: `rise-in .9s ${0.08 + i * 0.045}s var(--ease-expo) both` }}
            >
              {ch === ' ' ? ' ' : ch}
            </span>
          ))}
        </h1>
        {hero && (
          <div
            className="pointer-events-none absolute inset-x-[4%] top-[34%] bottom-[22%] md:inset-x-auto md:right-[4%] md:top-[18%] md:bottom-[10%] md:w-[46%]"
            style={{ animation: 'hero-drop 1.3s .25s var(--ease-expo) both' }}
          >
            <div className="h-full w-full" style={{ animation: 'float-y 6s ease-in-out infinite', ['--r' as string]: '-4deg' }}>
              <ProductImage slug={hero.slug} colorId={hero.color} alt={hero.name} priority sizes="(max-width:768px) 92vw, 46vw" className="drop-shadow-[0_40px_40px_rgba(0,0,0,0.25)]" />
            </div>
          </div>
        )}
        <div className="mt-auto flex flex-col gap-4 md:max-w-md">
          <p className="text-[17px] font-medium leading-snug md:text-[19px]" style={{ color: w.ink, animation: 'rise-in .8s .5s var(--ease-expo) both' }}>
            {description}
          </p>
          <p className="mono text-[12px] uppercase tracking-[0.14em]" style={{ color: w.ink, opacity: 0.85 }}>
            {count} products
          </p>
        </div>
      </div>
    </header>
  );
}
