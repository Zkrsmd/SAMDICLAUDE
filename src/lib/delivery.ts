import 'server-only';
import { WILAYAS, type Wilaya } from '@/data/delivery/wilayas';
import { readOverrides } from '@/lib/store/overrides';
import type { DeliveryMethod } from '@/lib/validation/order';

/** Every wilaya with the prices in force: the ones saved in Admin → Delivery, else the starting list. */
export function getWilayas(): (Wilaya & { edited: boolean })[] {
  const saved = readOverrides().delivery?.tariffs ?? {};
  return WILAYAS.map((w) => {
    const t = saved[String(w.code)];
    return t ? { ...w, home: t.home, desk: t.desk, estimate: false, edited: true } : { ...w, edited: false };
  });
}

/** Delivery price in centimes, or null when that delivery isn't offered in the wilaya. */
export function deliveryFee(code: number, method: DeliveryMethod): number | null {
  const w = getWilayas().find((x) => x.code === code);
  const da = w ? w[method] : null;
  return da === null || da === undefined ? null : da * 100;
}
