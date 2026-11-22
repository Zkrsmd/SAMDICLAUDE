import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * The tests run against the local Cloudflare preview (npm run preview → http://localhost:8787) and its
 * LOCAL database (.wrangler/state). Every product starts as "Coming soon", so before the run two
 * products are put on sale there (a one-size whistle and sized boxing gloves); afterwards they go back
 * and the test orders are removed. The hosted database is never touched (--local).
 */
export const ON_SALE = {
  whistle: { slug: 'fox-40-classic-whistle', price: 98_000, sizes: ['One size'] },
  gloves: { slug: 'venum-boxing-gloves-black-gold', price: 430_000, sizes: ['10 oz', '12 oz', '14 oz', '16 oz'] },
} as const;

const generated = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src', 'data', 'products', 'generated.json'), 'utf8')) as {
  slug: string;
  name: string;
  brand: string;
  sport: string;
  sub: string;
  price: number;
  sizes: string[];
}[];

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
/** Runs SQL on the LOCAL database (through a file: Windows shells mangle quotes in arguments). */
const local = (command: string) => {
  const file = path.join(os.tmpdir(), `smadi-e2e-${process.pid}.sql`);
  fs.writeFileSync(file, command);
  try {
    execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['wrangler', 'd1', 'execute', 'smadi', '--local', '--yes', `--file=${file}`], {
      stdio: 'pipe',
      shell: process.platform === 'win32',
    });
  } finally {
    fs.rmSync(file, { force: true });
  }
};

function input(slug: string) {
  const p = generated.find((x) => x.slug === slug)!;
  return {
    name: p.name,
    brand: p.brand,
    sport: p.sport,
    sub: p.sub,
    price: p.price,
    compareAt: null,
    cost: null,
    short: 'On sale for the end-to-end tests.',
    description: `${p.name}. On sale for the end-to-end tests.`,
    sizes: p.sizes,
    stock: Object.fromEntries(p.sizes.map((s) => [s, 25])),
    sku: '',
    colorName: 'As shown',
    swatch: '#8E99A8',
    tags: [],
    bestSeller: true,
    isNew: false,
    featured: false,
    comingSoon: false,
    status: 'active',
    seoTitle: '',
    seoDescription: '',
  };
}

const bump = () => `UPDATE store_meta SET value = 'e2e-${Date.now()}' WHERE key = 'version'`;
const slugs = Object.values(ON_SALE)
  .map((x) => q(x.slug))
  .join(', ');
const CLEAN = ['DELETE FROM rate', `DELETE FROM orders WHERE data LIKE '%"note":"e2e%'`];

/** Forget the local rate-limit counters (several tests place orders from the same connection). */
export function resetRateLimits() {
  local(`${CLEAN[0]};`);
}

export default function setup() {
  const rows = Object.values(ON_SALE)
    .map((x) => `(${q(x.slug)}, 'edit', 0, ${q(JSON.stringify(input(x.slug)))})`)
    .join(', ');
  local(`INSERT INTO store_products (slug, kind, pos, data) VALUES ${rows} ON CONFLICT(slug) DO UPDATE SET data = excluded.data; ${CLEAN.join('; ')}; ${bump()};`);
  return () => {
    local(`DELETE FROM store_products WHERE slug IN (${slugs}); ${CLEAN.join('; ')}; ${bump()};`);
  };
}
