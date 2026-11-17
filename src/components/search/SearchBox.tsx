'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';

export function SearchBox({ initial }: { initial: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(initial);
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const next = new URLSearchParams(params.toString());
        const term = q.trim().slice(0, 80);
        if (term) next.set('q', term);
        else next.delete('q');
        router.push(`/search${next.toString() ? `?${next}` : ''}`);
      }}
      className="flex items-center gap-2 border-b-2 border-ink"
    >
      <Icon name="search" />
      <label htmlFor="search-page-input" className="sr-only">
        Search products
      </label>
      <input
        id="search-page-input"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        maxLength={80}
        placeholder="Search products, brands, sports"
        className="h-14 flex-1 bg-transparent text-[18px] outline-none"
      />
      <button type="submit" className="btn btn-ink h-11 px-4">
        Search
      </button>
    </form>
  );
}
