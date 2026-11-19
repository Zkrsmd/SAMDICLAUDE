import 'server-only';
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

/**
 * Admin sign-in: one password from the environment (ADMIN_PASSWORD, never in the repo), and a
 * signed, http-only session cookie. The signing key is derived from the password (or
 * ADMIN_SESSION_SECRET when set), so changing the password signs everyone out.
 *
 * Every admin page and every admin action calls requireAdmin() itself — layouts are not re-run
 * on client navigation, so they can't be the only guard.
 */

export const ADMIN_COOKIE = 'smadi_admin';
const TTL_S = 60 * 60 * 12;

const password = () => process.env.ADMIN_PASSWORD ?? '';
export const adminConfigured = () => password().length >= 8;

const key = () => crypto.createHash('sha256').update(`smadi-admin|${process.env.ADMIN_SESSION_SECRET || password()}`).digest();
const sign = (payload: string) => crypto.createHmac('sha256', key()).update(payload).digest('base64url');

const safeEqual = (a: string, b: string) => {
  const x = crypto.createHash('sha256').update(a).digest();
  const y = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(x, y);
};

export function verifyToken(token: string | undefined) {
  if (!token || !adminConfigured()) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) * 1000 < Date.now()) return false;
  return safeEqual(sig, sign(`v1.${exp}`));
}

export const checkPassword = (attempt: string) => adminConfigured() && safeEqual(attempt, password());

export async function isAdmin() {
  return verifyToken((await cookies()).get(ADMIN_COOKIE)?.value);
}

/** For admin pages: signed out → the sign-in page. */
export async function requireAdmin() {
  if (!(await isAdmin())) redirect('/admin/login');
}

export async function startSession() {
  const exp = Math.floor(Date.now() / 1000) + TTL_S;
  // `secure` holds on http://localhost too: browsers treat localhost as a secure origin
  (await cookies()).set(ADMIN_COOKIE, `${exp}.${sign(`v1.${exp}`)}`, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: TTL_S,
  });
}

export async function endSession() {
  (await cookies()).delete(ADMIN_COOKIE);
}
