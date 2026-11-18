import type { ReactNode } from 'react';
import type { SportSlug } from '@/types/catalog';

/**
 * Coded field-of-play artwork for the arena cards: crisp vector markings over soft tonal
 * ground, one per sport (pitch, ring, pool, court, track, plate). Markings draw themselves in
 * when the card is revealed (`.arena-draw`), and brighten on hover.
 *
 * Two stacked SVGs: the ground (gradients, stripes, fills) is painted once; only the thin line
 * layer repaints while the markings draw in, so the reveal stays cheap.
 */

const TONE: Record<string, [string, string]> = {
  football: ['#EDF1EE', '#D9E2DC'],
  boxing: ['#F1EDE7', '#E0D8CC'],
  swimming: ['#E9F2F4', '#D2E2E6'],
  basketball: ['#F2ECE4', '#E1D5C6'],
  running: ['#F1ECE8', '#E3D6CD'],
  fitness: ['#EEF0F3', '#DCE1E7'],
};

function Draw({ d, i = 0 }: { d: string; i?: number }) {
  return <path d={d} pathLength={1} className="arena-draw" style={{ ['--i' as string]: i }} />;
}

interface Art {
  base: ReactNode;
  lines: ReactNode;
  over?: ReactNode;
}

const pitch = (): Art => ({
  base: Array.from({ length: 10 }, (_, i) => <rect key={i} x={i * 40} width={40} height={500} fill="#fff" opacity={i % 2 ? 0.26 : 0} />),
  lines: (
    <g fill="none" stroke="#fff" strokeWidth={1.8}>
      <Draw d="M30 30H370V470H30Z" />
      <Draw d="M30 250H370" i={1} />
      <Draw d="M262 250A62 62 0 1 1 138 250A62 62 0 1 1 262 250" i={2} />
      <Draw d="M110 30V108H290V30" i={3} />
      <Draw d="M158 30V60H242V30" i={4} />
      <Draw d="M168 108A46 46 0 0 0 232 108" i={5} />
      <Draw d="M110 470V392H290V470" i={3} />
      <Draw d="M158 470V440H242V470" i={4} />
      <Draw d="M168 392A46 46 0 0 1 232 392" i={5} />
    </g>
  ),
  over: <circle cx={200} cy={250} r={3} fill="#fff" />,
});

const ring = (): Art => ({
  base: <rect x={64} y={114} width={272} height={272} fill="#fff" opacity={0.42} />,
  lines: (
    <g fill="none" stroke="#fff" strokeWidth={2.4}>
      <Draw d="M52 102H348V398H52Z" />
      <Draw d="M42 92H358V408H42Z" i={1} />
      <Draw d="M32 82H368V418H32Z" i={2} />
      <Draw d="M248 250A48 48 0 1 1 152 250A48 48 0 1 1 248 250" i={3} />
    </g>
  ),
  over: [
    [32, 82],
    [368, 82],
    [32, 418],
    [368, 418],
  ].map(([x, y], i) => (
    <g key={i}>
      <circle cx={x} cy={y} r={11} fill={i === 0 ? '#2B59FF' : '#0F1216'} opacity={i === 0 ? 0.9 : 0.72} />
      <circle cx={x! - 3} cy={y! - 3} r={3.5} fill="#fff" opacity={0.6} />
    </g>
  )),
});

const pool = (): Art => {
  const lanes = [40, 120, 200, 280, 360, 440];
  return {
    base: (
      <g fill="none" stroke="#fff" strokeWidth={1.2} opacity={0.5}>
        {Array.from({ length: 9 }, (_, k) => (
          <path key={k} d={`M0 ${30 + k * 56} C 70 ${12 + k * 56}, 130 ${52 + k * 56}, 200 ${30 + k * 56} S 330 ${10 + k * 56}, 400 ${32 + k * 56}`} />
        ))}
      </g>
    ),
    lines: (
      <g fill="none">
        {lanes.slice(0, -1).map((y, i) => (
          <g key={y} stroke="#16323C" strokeOpacity={0.26} strokeWidth={7}>
            <Draw d={`M52 ${y + 40}H348`} i={i} />
            <Draw d={`M52 ${y + 28}V${y + 52}M348 ${y + 28}V${y + 52}`} i={i + 1} />
          </g>
        ))}
      </g>
    ),
    over: lanes.map((y, i) => (
      <line key={y} x1={0} x2={400} y1={y} y2={y} stroke={i % 2 ? '#fff' : '#8E99A8'} strokeWidth={7} strokeLinecap="round" strokeDasharray="0 13" opacity={0.85} />
    )),
  };
};

const court = (): Art => ({
  base: (
    <>
      <g stroke="#7A5C40" strokeOpacity={0.08} strokeWidth={1}>
        {Array.from({ length: 24 }, (_, k) => (
          <line key={k} x1={0} x2={400} y1={k * 22} y2={k * 22} />
        ))}
      </g>
      <rect x={140} y={40} width={120} height={190} fill="#fff" opacity={0.3} />
    </>
  ),
  lines: (
    <g fill="none" stroke="#fff" strokeWidth={2}>
      <Draw d="M30 40H370V470H30Z" />
      <Draw d="M140 40V230H260V40" i={1} />
      <Draw d="M258 230A58 58 0 1 1 142 230A58 58 0 1 1 258 230" i={2} />
      <Draw d="M52 40V130A149.4 149.4 0 1 0 348 130V40" i={3} />
      <Draw d="M176 70A24 24 0 0 0 224 70" i={4} />
      <Draw d="M170 58H230" i={4} />
      <Draw d="M140 470A60 60 0 0 1 260 470" i={5} />
    </g>
  ),
  over: <circle cx={200} cy={70} r={9} fill="none" stroke="#C26A35" strokeWidth={3} opacity={0.8} />,
});

const track = (): Art => ({
  base: <path d="M40 260A160 160 0 0 1 360 260V340A160 160 0 0 1 40 340Z" fill="#C4785A" opacity={0.1} transform="translate(0 -60)" />,
  lines: (
    <g fill="none" stroke="#fff" strokeWidth={1.8}>
      {Array.from({ length: 6 }, (_, i) => {
        const o = i * 14;
        const r = 160 - o;
        return <Draw key={i} i={i} d={`M${40 + o} 200A${r} ${r} 0 0 1 ${360 - o} 200V${280}A${r} ${r} 0 0 1 ${40 + o} 280Z`} />;
      })}
    </g>
  ),
  over: (
    <g fill="#fff" opacity={0.85} fontFamily="ui-monospace, monospace" fontSize={11} fontWeight={600}>
      {Array.from({ length: 5 }, (_, i) => (
        <text key={i} x={200} y={447 - i * 14} textAnchor="middle">
          {i + 1}
        </text>
      ))}
    </g>
  ),
});

const plate = (): Art => ({
  base: (
    <g stroke="#fff" strokeOpacity={0.55} strokeWidth={1}>
      {Array.from({ length: 9 }, (_, k) => (
        <line key={`h${k}`} x1={0} x2={400} y1={k * 60} y2={k * 60} />
      ))}
      {Array.from({ length: 8 }, (_, k) => (
        <line key={`v${k}`} y1={0} y2={500} x1={k * 60 + 20} x2={k * 60 + 20} />
      ))}
    </g>
  ),
  lines: (
    <g fill="none" stroke="#fff" strokeWidth={2.2}>
      {[150, 128, 104, 40, 16].map((r, i) => (
        <Draw key={r} i={i} d={`M${200 + r} 250A${r} ${r} 0 1 1 ${200 - r} 250A${r} ${r} 0 1 1 ${200 + r} 250`} />
      ))}
    </g>
  ),
});

const ART: Partial<Record<SportSlug, () => Art>> = { football: pitch, boxing: ring, swimming: pool, basketball: court, running: track, fitness: plate };

export function ArenaArt({ sport }: { sport: SportSlug }) {
  const [a, b] = TONE[sport] ?? ['#F1F2F4', '#E3E6EA'];
  const art = ART[sport]?.();
  const id = `arena-${sport}`;
  return (
    <span aria-hidden className="arena-art">
      <svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0" stopColor={a} />
            <stop offset="1" stopColor={b} />
          </linearGradient>
          <radialGradient id={`${id}-light`} cx="0.5" cy="0.56" r="0.62">
            <stop offset="0" stopColor="#fff" stopOpacity={0.9} />
            <stop offset="0.55" stopColor="#fff" stopOpacity={0.18} />
            <stop offset="1" stopColor="#fff" stopOpacity={0} />
          </radialGradient>
        </defs>
        <rect width={400} height={500} fill={`url(#${id}-bg)`} />
        {art?.base}
      </svg>
      <svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" className="arena-lines">
        {art?.lines}
      </svg>
      <svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice">
        {art?.over}
        <rect width={400} height={500} fill={`url(#${id}-light)`} className="arena-glow" />
      </svg>
    </span>
  );
}
