import Link from 'next/link';

export function Breadcrumbs({ items, light }: { items: { label: string; href?: string }[]; light?: boolean }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className={`eyebrow flex flex-wrap items-center gap-1.5 ${light ? 'text-white/80' : 'text-muted'}`}>
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden>/</span>}
            {it.href ? (
              <Link href={it.href} className={`hover:underline ${light ? 'hover:text-white' : 'hover:text-ink'}`}>
                {it.label}
              </Link>
            ) : (
              <span aria-current="page" className={light ? 'text-white' : 'text-ink'}>
                {it.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
