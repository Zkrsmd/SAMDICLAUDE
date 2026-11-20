import { z } from 'zod';

/**
 * The cash-on-delivery checkout form. Client-safe: the form checks with these rules as you type and
 * the order API enforces the same ones. Prices are never part of it — the server prices the order.
 */

export const DELIVERY_METHODS = ['home', 'desk'] as const;
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number];
export const CONFIRM_BY = ['call', 'sms'] as const;
export type ConfirmBy = (typeof CONFIRM_BY)[number];

/**
 * An Algerian mobile number → "0XXXXXXXXX". Accepts 05/06/07 + 8 digits, written with spaces,
 * dots or dashes, or in international form (+213 / 00213, with or without the leading 0).
 */
export function normalizePhone(raw: string): string | null {
  const d = raw.replace(/[\s.\-()]/g, '');
  const m = /^(?:\+213|00213)0?([567]\d{8})$/.exec(d) ?? /^0([567]\d{8})$/.exec(d);
  return m ? `0${m[1]}` : null;
}
/** "0555123456" → "0555 12 34 56" */
export const formatPhone = (p: string) => p.replace(/^(\d{4})(\d{2})(\d{2})(\d{2})$/, '$1 $2 $3 $4');

const name = (what: string) =>
  z
    .string()
    .trim()
    .min(2, `Enter your ${what}`)
    .max(40, 'Too long')
    .regex(/^[\p{L}][\p{L}\p{M}' .-]*$/u, 'Letters only');

export const CheckoutSchema = z.object({
  firstName: name('first name'),
  lastName: name('last name'),
  phone: z
    .string()
    .max(24)
    .transform((v, ctx) => {
      const p = normalizePhone(v);
      if (!p) {
        ctx.addIssue({ code: 'custom', message: 'Enter a mobile number: 05, 06 or 07 then 8 digits' });
        return z.NEVER;
      }
      return p;
    }),
  wilaya: z.number({ message: 'Choose your wilaya' }).int().min(1, 'Choose your wilaya').max(58, 'Choose your wilaya'),
  commune: z.string().trim().min(2, 'Enter your commune').max(60, 'Too long'),
  address: z.string().trim().min(6, 'Enter your address (street, building, number)').max(200, 'Too long'),
  method: z.enum(DELIVERY_METHODS),
  confirm: z.enum(CONFIRM_BY),
  note: z.string().trim().max(300, 'Up to 300 characters').default(''),
  items: z
    .array(
      z.object({
        productId: z.string().min(1).max(120),
        colorId: z.string().min(1).max(60),
        size: z.string().min(1).max(32),
        qty: z.number().int().min(1).max(20),
      }),
    )
    .min(1, 'Your bag is empty')
    .max(30),
  /** honeypot: a field people never see. Bots fill it in; the order is then dropped. */
  website: z.string().max(200).optional(),
});
export type CheckoutInput = z.input<typeof CheckoutSchema>;
export type CheckoutData = z.output<typeof CheckoutSchema>;
