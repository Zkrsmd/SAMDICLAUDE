import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { brand } from '@/config/brand';
import { COURIER } from '@/data/delivery/wilayas';
import { requireAdmin } from '@/lib/admin/auth';
import { getOrder, loadAdminData } from '@/lib/admin/orders';
import { formatPrice } from '@/lib/format';
import { siteLinks } from '@/lib/site-links';
import { formatPhone } from '@/lib/validation/order';
import { PrintBar } from './PrintBar';
import './receipt.css';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ f?: string }> };

export const metadata: Metadata = { title: 'Receipt' };

const date = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} · ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
};

/**
 * A printable receipt for one order (Admin → order → Print receipt): the STRYKE logo, the order
 * number and date, who it goes to, what was bought, delivery and the total to collect in cash.
 * In French for the customer (the parcel's paper). Two formats: A4 page or an 80 mm ticket (?f=ticket).
 */
export default async function ReceiptPage({ params, searchParams }: Props) {
  await loadAdminData();
  await requireAdmin();
  const { id } = await params;
  const ticket = (await searchParams).f === 'ticket';
  const o = getOrder(id);
  if (!o) notFound();
  const cod = o.cod;
  const links = siteLinks();
  const social = [links.facebook && 'Facebook', links.instagram && 'Instagram', links.tiktok && 'TikTok'].filter(Boolean).join(' · ');
  return (
    <div className="rc-page" data-format={ticket ? 'ticket' : 'a4'}>
      <PrintBar id={o.id} ticket={ticket} />
      <article className="rc" aria-label={`Receipt for order ${o.number}`}>
        <header className="rc-head">
          <div className="rc-brand">
            <svg viewBox="0 0 48 48" className="rc-mark" aria-hidden>
              <rect width="48" height="48" rx="12" fill="#0F1216" />
              <g transform="skewX(-10) translate(6 0)" fill="none" stroke="#fff" strokeWidth="5.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M30 13H20.5a6.5 6.5 0 0 0 0 13h6a6.5 6.5 0 0 1 0 13H15" />
              </g>
              <circle cx="37" cy="37" r="3" fill="#2B59FF" />
            </svg>
            <div>
              <p className="rc-name">
                STR<span>Y</span>KE
              </p>
              <p className="rc-sub">{brand.socialName} · Boutique de sport</p>
            </div>
          </div>
          <div className="rc-meta">
            <p className="rc-title">Bon de commande</p>
            <p>
              N° <strong>{o.number}</strong>
            </p>
            <p>{date(o.createdAt)}</p>
          </div>
        </header>

        <section className="rc-parties">
          <div>
            <p className="rc-label">Client</p>
            <p className="rc-strong">{o.customer.name}</p>
            {cod ? (
              <>
                <p className="rc-mono">{formatPhone(cod.phone)}</p>
                <p>
                  {cod.commune}
                  {cod.address ? `, ${cod.address}` : ''}
                </p>
                <p>
                  {String(cod.wilaya).padStart(2, '0')} · {cod.wilayaName}
                </p>
              </>
            ) : (
              <p>{o.customer.city}</p>
            )}
          </div>
          <div>
            <p className="rc-label">Livraison</p>
            <p className="rc-strong">{COURIER}</p>
            <p>{cod ? (cod.method === 'home' ? 'À domicile' : 'Stop desk (au bureau)') : 'À domicile'}</p>
            <p className="rc-label mt">Paiement</p>
            <p className="rc-strong">À la livraison, en espèces</p>
          </div>
        </section>

        <table className="rc-table">
          <thead>
            <tr>
              <th>Article</th>
              <th className="c">Taille</th>
              <th className="c">Qté</th>
              <th className="r">Prix</th>
              <th className="r">Total</th>
            </tr>
          </thead>
          <tbody>
            {o.lines.map((l, i) => (
              <tr key={i}>
                <td>
                  <span className="rc-item">{l.name}</span>
                  <span className="rc-brandname">{l.brandName}</span>
                </td>
                <td className="c">{l.size}</td>
                <td className="c">{l.qty}</td>
                <td className="r rc-mono">{formatPrice(l.unit)}</td>
                <td className="r rc-mono">{formatPrice(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="rc-sum">
          <div>
            <dt>Sous-total · {o.items} article{o.items > 1 ? 's' : ''}</dt>
            <dd className="rc-mono">{formatPrice(o.subtotal)}</dd>
          </div>
          <div>
            <dt>Livraison</dt>
            <dd className="rc-mono">{o.shipping ? formatPrice(o.shipping) : 'Offerte'}</dd>
          </div>
          <div className="rc-total">
            <dt>Total à payer</dt>
            <dd className="rc-mono">{formatPrice(o.total)}</dd>
          </div>
        </dl>

        {cod?.note ? (
          <p className="rc-note">
            <span className="rc-label">Note du client</span>
            {cod.note}
          </p>
        ) : null}

        <footer className="rc-foot">
          <p className="rc-thanks">Merci pour votre commande !</p>
          <p>Vérifiez votre colis à la réception. Pour un échange de taille, contactez-nous.</p>
          {social ? (
            <p>
              Suivez-nous : {brand.socialName} — {social}
            </p>
          ) : null}
        </footer>
      </article>
    </div>
  );
}
