/**
 * Website (cash-on-delivery) order statuses, in the order an order normally moves through them.
 * Client-safe: the admin's status picker and badges use it; src/lib/store/orders.ts enforces it.
 *
 *   new (to call) → [no answer →] confirmed → preparing → shipped → delivered
 *   or, at any point: cancelled · after shipping: returned   (both put the stock back)
 */
export const COD_STATUS = ['new', 'no_answer', 'confirmed', 'preparing', 'shipped', 'delivered', 'returned', 'cancelled'] as const;
export type CodStatus = (typeof COD_STATUS)[number];

/** the main road, shown as steps on the order page */
export const PIPELINE: CodStatus[] = ['new', 'confirmed', 'preparing', 'shipped', 'delivered'];

export const STATUS_INFO: Record<CodStatus, { label: string; hint: string }> = {
  new: { label: 'To confirm', hint: 'New order — call the customer to confirm' },
  no_answer: { label: 'No answer', hint: 'Called, no answer yet — try again later' },
  confirmed: { label: 'Confirmed', hint: 'The customer confirmed on the phone' },
  preparing: { label: 'Preparing', hint: 'Being packed for the courier' },
  shipped: { label: 'Shipped', hint: 'Handed to the courier' },
  delivered: { label: 'Delivered', hint: 'Delivered and paid in cash' },
  returned: { label: 'Returned', hint: 'Came back — stock put back' },
  cancelled: { label: 'Cancelled', hint: 'Cancelled — stock put back' },
};

/** statuses where the goods are back on the shelf */
export const OFF_SHELF = new Set<CodStatus>(['returned', 'cancelled']);
/** still being handled (not delivered, returned or cancelled) */
export const OPEN = new Set<CodStatus>(['new', 'no_answer', 'confirmed', 'preparing', 'shipped']);
