import 'server-only';

/**
 * Minimal fixed-window rate limiter (in-memory, per server instance).
 * Prototype only — production should use a shared store (e.g. Redis) at the edge. See SECURITY.md.
 */
const windows = new Map<string, { start: number; count: number }>();

export function rateLimit(key: string, limit = 60, windowMs = 60_000) {
  const now = Date.now();
  const w = windows.get(key);
  if (!w || now - w.start > windowMs) {
    windows.set(key, { start: now, count: 1 });
    if (windows.size > 5000) {
      for (const [k, v] of windows) if (now - v.start > windowMs) windows.delete(k);
      // hard cap: drop the oldest entries if the map is still too large
      for (const k of windows.keys()) {
        if (windows.size <= 5000) break;
        windows.delete(k);
      }
    }
    return { ok: true, remaining: limit - 1 };
  }
  w.count += 1;
  return { ok: w.count <= limit, remaining: Math.max(0, limit - w.count) };
}

/**
 * Prefer the address set by the platform/proxy (x-real-ip). Otherwise use the right-most
 * X-Forwarded-For hop (appended by our proxy) — the left-most value is client-controlled.
 */
export function clientKey(headers: Headers) {
  const real = headers.get('x-real-ip')?.trim();
  if (real) return real;
  const hops = headers.get('x-forwarded-for')?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  return hops[hops.length - 1] ?? 'local';
}
