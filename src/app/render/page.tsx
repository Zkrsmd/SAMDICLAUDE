import { notFound } from 'next/navigation';
import { getAllProducts } from '@/lib/catalog';
import { RenderStudio } from '@/components/render/RenderStudio';

export const metadata = { title: 'Render studio', robots: { index: false } };

/** Dev-only: produces representative product renders for `npm run renders`. */
export default function RenderPage() {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_RENDER_ROUTE !== '1') notFound();
  const jobs = getAllProducts().map((p) => ({
    slug: p.slug,
    kind: p.model.kind,
    options: p.model.options ?? {},
    colors: p.colors.map((c) => ({ id: c.id, palette: c.palette })),
  }));
  return <RenderStudio products={jobs} />;
}
