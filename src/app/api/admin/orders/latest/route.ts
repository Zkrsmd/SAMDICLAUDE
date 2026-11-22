import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ADMIN_COOKIE, verifyToken } from '@/lib/admin/auth';
import { getDb } from '@/lib/store/db';

export const dynamic = 'force-dynamic';

/**
 * For the admin's new-order alert (AdminShell → OrderAlerts), asked every few seconds while the
 * admin is open: the newest website order and how many still wait to be confirmed. Admin only.
 */
export async function GET() {
  if (!verifyToken((await cookies()).get(ADMIN_COOKIE)?.value)) return NextResponse.json({ error: 'Sign in again' }, { status: 401 });
  try {
    const db = await getDb();
    const [latest, waiting] = await db.batch([
      db.prepare('SELECT id, number, data FROM orders ORDER BY number DESC LIMIT 1'),
      db.prepare("SELECT COUNT(*) AS n FROM orders WHERE status IN ('new', 'no_answer') AND archived = 0"),
    ]);
    const row = (latest!.results?.[0] ?? null) as { id: string; number: number; data: string } | null;
    let order: { id: string; number: number; name: string; total: number; items: number } | null = null;
    if (row) {
      const d = JSON.parse(row.data) as { firstName?: string; lastName?: string; total?: number; lines?: { qty: number }[] };
      order = {
        id: row.id,
        number: row.number,
        name: `${d.firstName ?? ''} ${d.lastName ?? ''}`.trim(),
        total: d.total ?? 0,
        items: (d.lines ?? []).reduce((n, l) => n + l.qty, 0),
      };
    }
    const n = (waiting!.results?.[0] as { n: number } | undefined)?.n ?? 0;
    return NextResponse.json({ order, waiting: n }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ order: null, waiting: 0 }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
