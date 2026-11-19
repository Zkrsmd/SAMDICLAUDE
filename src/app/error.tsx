'use client';
import Link from 'next/link';

/** Error boundary — never shows stack traces or internal messages to customers. */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="container-x flex min-h-[80svh] flex-col justify-center" style={{ paddingTop: 88 }}>
      <p className="eyebrow text-muted">Something went wrong</p>
      <h1 className="display mt-3 text-[clamp(44px,10vw,104px)]">Time out</h1>
      <p className="mt-3 max-w-md text-muted">We couldn’t load this page. Please try again.</p>
      <div className="mt-8 flex gap-3">
        <button type="button" className="btn btn-ink h-12" onClick={() => reset()}>
          Try again
        </button>
        <Link href="/" className="btn btn-line h-12">
          Home
        </Link>
      </div>
    </div>
  );
}
