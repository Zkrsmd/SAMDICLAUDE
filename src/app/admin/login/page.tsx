import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/admin/LoginForm';
import { adminConfigured, isAdmin } from '@/lib/admin/auth';

export const metadata: Metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await isAdmin()) redirect('/admin');
  const { next } = await searchParams;
  return (
    <div className="adm grid min-h-svh place-items-center px-4 py-10">
      <main className="w-full max-w-[380px]">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-white">
            <span className="display text-[20px]">S</span>
          </span>
          <div>
            <p className="text-[16px] font-bold">STRYKE admin</p>
            <p className="text-[#66707c]">Sign in to manage the store</p>
          </div>
        </div>
        <div className="adm-card adm-card-pad">
          {adminConfigured() ? (
            <LoginForm next={typeof next === 'string' ? next : ''} />
          ) : (
            <div role="note">
              <p className="font-semibold">The admin is locked</p>
              <p className="mt-2 text-[#4a525c]">
                Set <span className="mono">ADMIN_PASSWORD</span> (8+ characters) in <span className="mono">.env.local</span> — or in your host’s environment
                settings — and restart the server.
              </p>
            </div>
          )}
        </div>
        <p className="mt-4 text-center text-[12.5px] text-[#66707c]">
          <Link href="/" className="adm-link">
            ← Back to the store
          </Link>
        </p>
      </main>
    </div>
  );
}
