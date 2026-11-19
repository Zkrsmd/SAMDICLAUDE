import Link from 'next/link';
import { StoreChrome } from '@/components/layout/StoreChrome';

export default function NotFound() {
  // unknown addresses anywhere (store or admin) land here, inside the store's header and footer
  return (
    <StoreChrome>
      <div className="container-x flex min-h-[80svh] flex-col justify-center" style={{ paddingTop: 88 }}>
        <p className="eyebrow text-muted">404</p>
        <h1 className="display mt-3 text-[clamp(44px,10vw,104px)]">Out of bounds</h1>
        <p className="mt-3 max-w-md text-muted">That page isn’t on the pitch. Head back and pick a sport.</p>
        <div className="mt-8 flex gap-3">
          <Link href="/" className="btn btn-ink h-12">
            Home
          </Link>
          <Link href="/search" className="btn btn-line h-12">
            Search products
          </Link>
        </div>
      </div>
    </StoreChrome>
  );
}
