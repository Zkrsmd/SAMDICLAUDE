/**
 * A seam of liquid chrome between two parts of the page — the same matter as the hero's drip, so
 * the whole scroll reads as one flow. The drips pour down as the seam crosses the screen (a CSS
 * scroll timeline: compositor only, no JS) and a few droplets keep falling from their tips.
 */

function rnd(seed: number) {
  let a = seed;
  return () => ((a = (a * 16807) % 2147483647) / 2147483647);
}

const W = 1440;

export function LiquidSeam({ seed = 1, flip = false }: { seed?: number; flip?: boolean }) {
  const r = rnd(seed * 7919 + 13);
  const n = 22;
  const drips = Array.from({ length: n }, (_, i) => {
    const w = 11 + r() * 24;
    const x = ((i + 0.5 + (r() - 0.5) * 0.7) / n) * W;
    const len = 22 + Math.pow(r(), 1.6) * 104;
    return { x, w, len };
  });
  const falling = drips.filter((d) => d.len > 60).slice(0, 3);
  const id = `seam-${seed}`;
  const defs = (
    <defs>
      <linearGradient id={`${id}-steel`} x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#B0BAC6" />
        <stop offset="0.22" stopColor="#707B8A" />
        <stop offset="0.48" stopColor="#C4CCD6" />
        <stop offset="0.74" stopColor="#606C7C" />
        <stop offset="1" stopColor="#A8B2BE" />
      </linearGradient>
      <linearGradient id={`${id}-shine`} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.85" />
        <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
      </linearGradient>
    </defs>
  );
  const box = { viewBox: `0 0 ${W} 150`, preserveAspectRatio: 'xMidYMin slice' } as const;
  return (
    <div aria-hidden className={`liquid-seam${flip ? ' is-flip' : ''}`}>
      {/* the drips pour by scaling this wrapper (compositor), never by animating SVG shapes */}
      <div className="seam-pour">
        <svg {...box}>
          {defs}
          <g fill={`url(#${id}-steel)`}>
            {drips.map((d, i) => (
              <g key={i}>
                <rect x={d.x - d.w / 2} y={0} width={d.w} height={d.len} rx={d.w / 2} />
                <circle cx={d.x} cy={d.len - d.w * 0.15} r={d.w * 0.62} />
                <rect x={d.x - d.w * 0.22} y={6} width={d.w * 0.16} height={d.len * 0.7} rx={d.w * 0.08} fill={`url(#${id}-shine)`} />
              </g>
            ))}
          </g>
        </svg>
      </div>
      <svg {...box}>
        <rect x={0} y={0} width={W} height={12} fill={`url(#${id}-steel)`} />
        <rect x={0} y={2} width={W} height={2.5} fill="#FFFFFF" opacity={0.55} />
      </svg>
      <div className="seam-falls">
        <svg {...box}>
          {falling.map((d, i) => (
            <circle key={i} className="seam-drop" cx={d.x} cy={d.len + d.w * 0.6} r={d.w * 0.34} fill={`url(#${id}-steel)`} style={{ animationDelay: `${((i * 1.3 + seed * 0.7) % 3.6).toFixed(2)}s` }} />
          ))}
        </svg>
      </div>
    </div>
  );
}
