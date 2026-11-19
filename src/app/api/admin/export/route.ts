import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ADMIN_COOKIE, verifyToken } from '@/lib/admin/auth';
import { readOverrides } from '@/lib/store/overrides';

/** Download every admin change as one JSON file (import it again in Settings). */
export async function GET() {
  if (!verifyToken((await cookies()).get(ADMIN_COOKIE)?.value)) return NextResponse.json({ error: 'Sign in again' }, { status: 401 });
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(`${JSON.stringify(readOverrides(), null, 2)}\n`, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="smadi-store-${day}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
