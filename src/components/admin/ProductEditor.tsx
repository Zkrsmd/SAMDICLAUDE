'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState, useTransition } from 'react';
import { createProduct, deleteProduct, duplicateProduct, saveProduct } from '@/app/admin/actions';
import { ProductInputSchema, PRODUCT_STATUS, colorsOf, fieldErrors, type ProductInput } from '@/lib/validation/admin';
import { rankSearch } from '@/lib/search';
import type { SearchIndexEntry } from '@/lib/catalog';
import { AIcon, Badge, Card, money } from './ui';
import { ConfirmDialog, Stepper, Switch, toast, useLeaveGuard } from './client';

type SportOpt = { slug: string; name: string; subs: { slug: string; name: string }[] };
interface Meta {
  slug?: string;
  image?: string;
  image2?: string | null;
  sampleStock?: boolean;
  created?: boolean;
  live?: boolean;
}

const toCents = (s: string) => {
  const n = Number(s.replace(/[^0-9.]/g, ''));
  return s.trim() === '' || !Number.isFinite(n) ? null : Math.round(n * 100);
};
/** centimes → "6200" (whole dinars), "6200.50" only when there are centimes */
const fromCents = (c: number | null) => (c === null ? '' : (c / 100).toFixed(c % 100 ? 2 : 0));

const SIZE_PRESETS: { label: string; sizes: string[] }[] = [
  { label: 'One size', sizes: ['One size'] },
  { label: 'XS–XL', sizes: ['XS', 'S', 'M', 'L', 'XL'] },
  { label: 'UK 6–11', sizes: ['UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11'] },
  { label: 'Gloves oz', sizes: ['10 oz', '12 oz', '14 oz', '16 oz'] },
  { label: 'Ball sizes', sizes: ['3', '4', '5'] },
];

/**
 * Add / edit a product, laid out like Shopify's product page: the content on the left (title,
 * description, media, pricing, variants and stock, search listing), the organisation on the right
 * (status, sport and category, vendor, tags, merchandising). Unsaved changes raise a save bar.
 */

/** The photo as a WebP (longest side 1600px), made in the browser — the server only stores WebPs. */
async function toWebp(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Choose a photo (PNG, JPG or WebP)');
  const bmp = await createImageBitmap(file).catch(() => {
    throw new Error('That file could not be read as an image');
  });
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  for (const q of [0.88, 0.78, 0.65]) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', q));
    if (!blob || blob.type !== 'image/webp') throw new Error('This browser can’t prepare photos — use Chrome or Edge');
    if (blob.size <= 1_700_000) return blob;
  }
  throw new Error('That photo is too large');
}

export function ProductEditor({ initial: given, meta, sports, vendors, writable }: { initial: ProductInput; meta: Meta; sports: SportOpt[]; vendors: { id: string; name: string }[]; writable: boolean }) {
  const router = useRouter();
  const isNew = !meta.slug;
  // older records keep one colour in colorName/swatch: the editor works with the list
  const [initial] = useState<ProductInput>(() => ({ ...given, colors: colorsOf(given), backdrop: given.backdrop ?? '', picks: given.picks ?? [] }));
  const [form, setForm] = useState<ProductInput>(initial);
  const [prices, setPrices] = useState({ price: fromCents(initial.price), compareAt: fromCents(initial.compareAt), cost: fromCents(initial.cost) });
  const [base, setBase] = useState(() => JSON.stringify({ form: initial, prices: { price: fromCents(initial.price), compareAt: fromCents(initial.compareAt), cost: fromCents(initial.cost) } }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newSize, setNewSize] = useState('');
  const [tag, setTag] = useState('');
  const [images, setImages] = useState({ 1: meta.image ?? null, 2: meta.image2 ?? null } as Record<1 | 2, string | null>);

  const dirty = JSON.stringify({ form, prices }) !== base;
  useLeaveGuard(dirty);
  const set = <K extends keyof ProductInput>(k: K, v: ProductInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const subs = sports.find((s) => s.slug === form.sport)?.subs ?? [];

  const input = (): ProductInput => ({
    ...form,
    price: toCents(prices.price) ?? 0,
    compareAt: toCents(prices.compareAt),
    cost: toCents(prices.cost),
    stock: Object.fromEntries(form.sizes.map((s) => [s, form.stock[s] ?? 0])),
  });

  const save = () => {
    const data = input();
    const check = ProductInputSchema.safeParse(data);
    if (!check.success) {
      setErrors(fieldErrors(check.error));
      toast('Some fields need attention', 'bad');
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setErrors({});
    start(async () => {
      if (isNew) {
        const res = await createProduct(check.data);
        if (!res.ok) {
          setErrors(res.fields ?? {});
          toast(res.error, 'bad');
          return;
        }
        setBase(JSON.stringify({ form, prices }));
        toast('Product created');
        router.replace(`/admin/products/${res.data!.slug}`);
      } else {
        const res = await saveProduct(meta.slug!, check.data);
        if (!res.ok) {
          setErrors(res.fields ?? {});
          toast(res.error, 'bad');
          return;
        }
        setBase(JSON.stringify({ form, prices }));
        toast('Product saved');
        router.refresh();
      }
    });
  };

  const discard = () => {
    const b = JSON.parse(base) as { form: ProductInput; prices: typeof prices };
    setForm(b.form);
    setPrices(b.prices);
    setErrors({});
  };

  const margin = useMemo(() => {
    const p = toCents(prices.price);
    const c = toCents(prices.cost);
    if (!p || c === null) return null;
    return { profit: p - c, pct: (p - c) / p };
  }, [prices]);

  const addSizes = (list: string[]) => {
    const have = new Set(form.sizes.map((s) => s.toLowerCase()));
    const add = list.map((s) => s.trim()).filter((s) => s && !have.has(s.toLowerCase()));
    if (!add.length) return;
    setForm((f) => ({ ...f, sizes: [...f.sizes, ...add], stock: { ...f.stock, ...Object.fromEntries(add.map((s) => [s, 0])) } }));
  };
  const removeSize = (s: string) =>
    setForm((f) => {
      const stock = { ...f.stock };
      delete stock[s];
      return { ...f, sizes: f.sizes.filter((x) => x !== s), stock };
    });
  const units = form.sizes.reduce((n, s) => n + (form.stock[s] ?? 0), 0);

  const upload = async (slot: 1 | 2, file: File | undefined) => {
    if (!file || !meta.slug) return;
    toast('Uploading…');
    try {
      const body = new FormData();
      body.set('slug', meta.slug);
      body.set('slot', String(slot));
      body.set('file', await toWebp(file), `${meta.slug}-${slot}.webp`);
      const res = await fetch('/api/admin/media', { method: 'POST', body });
      const json = (await res.json()) as { url?: string; v?: number; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? 'Upload failed');
      setImages((m) => ({ ...m, [slot]: json.url! }));
      toast('Image saved');
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Upload failed', 'bad');
    }
  };

  const err = (k: string) =>
    errors[k] ? (
      <p className="adm-error" id={`err-${k}`}>
        {errors[k]}
      </p>
    ) : null;
  const inv = (k: string) => (errors[k] ? { 'aria-invalid': true as const, 'aria-describedby': `err-${k}` } : {});

  const seoTitle = form.seoTitle || form.name || 'Product title';
  const seoDesc = form.seoDescription || form.short || form.description;

  return (
    <>
      {(dirty || isNew) && (
        <div className="adm-savebar" role="region" aria-label="Unsaved changes">
          <AIcon name="alert" size={16} className="opacity-70" />
          <span className="flex-1 truncate font-semibold">{isNew ? 'New product' : 'Unsaved changes'}</span>
          {isNew ? (
            <Link href="/admin/products" className="adm-btn">
              Cancel
            </Link>
          ) : (
            <button type="button" className="adm-btn" onClick={discard} disabled={pending}>
              Discard
            </button>
          )}
          <button type="button" className="adm-btn adm-btn-primary" onClick={save} disabled={pending || !writable}>
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-3">
          <Card>
            <label htmlFor="p-name" className="adm-label">
              Title
            </label>
            <input id="p-name" className="adm-input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Mercurial Vapor 17 Elite FG" {...inv('name')} />
            {err('name')}
            <label htmlFor="p-short" className="adm-label mt-4">
              Short line
            </label>
            <input id="p-short" className="adm-input" value={form.short} onChange={(e) => set('short', e.target.value)} placeholder="One line shown under the name" {...inv('short')} />
            {err('short')}
            <label htmlFor="p-desc" className="adm-label mt-4">
              Description
            </label>
            <textarea id="p-desc" className="adm-textarea" rows={6} value={form.description} onChange={(e) => set('description', e.target.value)} {...inv('description')} />
            {err('description')}
          </Card>

          <Card title="Media" action={<span className="text-[12px] text-[#66707c]">Cut-outs on a transparent background look best</span>}>
            {isNew ? (
              <p className="text-[#66707c]">Save the product first, then add its photos here.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {([1, 2] as const).map((slot) => (
                  <MediaSlot key={slot} label={slot === 1 ? 'Main image' : 'Second view'} src={images[slot]} disabled={!writable} onFile={(f) => upload(slot, f)} />
                ))}
              </div>
            )}
            <div className="adm-sep mt-4 pt-4">
              <label htmlFor="p-backdrop" className="adm-label">
                Word behind the photo
              </label>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-start">
                <div>
                  <input
                    id="p-backdrop"
                    className="adm-input"
                    maxLength={24}
                    value={form.backdrop ?? ''}
                    placeholder={vendors.find((v) => v.id === form.brand)?.name ?? 'Brand name'}
                    onChange={(e) => set('backdrop', e.target.value)}
                    {...inv('backdrop')}
                  />
                  <p className="mt-1 text-[12px] text-[#66707c]">The big word on the product page, behind the product. Leave empty to show the brand. Any length fits on one line.</p>
                  {err('backdrop')}
                </div>
                <div className="adm-backdrop" aria-hidden>
                  <span style={{ ['--n' as string]: Math.max(4, (form.backdrop || vendors.find((v) => v.id === form.brand)?.name || '').length) }}>
                    {form.backdrop || vendors.find((v) => v.id === form.brand)?.name}
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {images[1] ? <img src={images[1]} alt="" /> : null}
                </div>
              </div>
            </div>
          </Card>

          <Card title="Pricing">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="p-price" className="adm-label">
                  Price
                </label>
                <div className="adm-affix">
                  <span>DA</span>
                  <input id="p-price" className="adm-input num" inputMode="decimal" value={prices.price} onChange={(e) => setPrices((p) => ({ ...p, price: e.target.value }))} {...inv('price')} />
                </div>
                {err('price')}
              </div>
              <div>
                <label htmlFor="p-compare" className="adm-label">
                  Compare-at price
                </label>
                <div className="adm-affix">
                  <span>DA</span>
                  <input
                    id="p-compare"
                    className="adm-input num"
                    inputMode="decimal"
                    value={prices.compareAt}
                    onChange={(e) => setPrices((p) => ({ ...p, compareAt: e.target.value }))}
                    placeholder="—"
                    {...inv('compareAt')}
                  />
                </div>
                {err('compareAt') ?? <p className="adm-help">Shows the price as a sale, the old price struck through.</p>}
              </div>
              <div>
                <label htmlFor="p-cost" className="adm-label">
                  Cost per item
                </label>
                <div className="adm-affix">
                  <span>DA</span>
                  <input id="p-cost" className="adm-input num" inputMode="decimal" value={prices.cost} onChange={(e) => setPrices((p) => ({ ...p, cost: e.target.value }))} placeholder="—" />
                </div>
                <p className="adm-help">Customers won’t see this.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 self-start rounded-[10px] bg-[#f6f7f9] p-3">
                <div>
                  <p className="text-[12px] text-[#66707c]">Profit</p>
                  <p className="num font-semibold">{margin ? money(margin.profit) : '—'}</p>
                </div>
                <div>
                  <p className="text-[12px] text-[#66707c]">Margin</p>
                  <p className="num font-semibold">{margin ? `${(margin.pct * 100).toFixed(1)}%` : '—'}</p>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Variants & inventory" action={<span className="num text-[12.5px] text-[#66707c]">{units} units</span>}>
            {meta.sampleStock && (
              <p className="adm-banner mb-3" data-tone="info">
                <AIcon name="alert" size={15} className="mt-0.5 shrink-0" />
                These stock numbers are sample values. Save to start tracking real stock: a size at 0 shows as sold out in the store.
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="p-sku" className="adm-label">
                  SKU
                </label>
                <input id="p-sku" className="adm-input mono" value={form.sku} onChange={(e) => set('sku', e.target.value)} placeholder="SM-1234" />
              </div>
            </div>
            <p className="adm-label mt-4">Sizes</p>
            <div className="flex flex-wrap gap-1.5">
              {SIZE_PRESETS.map((p) => (
                <button key={p.label} type="button" className="adm-btn adm-btn-sm" onClick={() => addSizes(p.sizes)}>
                  + {p.label}
                </button>
              ))}
            </div>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                addSizes(newSize.split(','));
                setNewSize('');
              }}
            >
              <input className="adm-input" value={newSize} onChange={(e) => setNewSize(e.target.value)} placeholder="Add sizes, separated by commas" aria-label="Add sizes" {...inv('sizes')} />
              <button type="submit" className="adm-btn">
                Add
              </button>
            </form>
            {err('sizes')}
            {form.sizes.length > 0 && (
              <div className="adm-table-wrap mt-3 rounded-[10px] shadow-[inset_0_0_0_1px_rgb(15_18_22/0.09)]">
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th>Variant</th>
                      <th>Available</th>
                      <th className="r">
                        <span className="sr-only">Remove</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.sizes.map((s) => {
                      const n = form.stock[s] ?? 0;
                      return (
                        <tr key={s}>
                          <td className="font-medium">
                            {s}
                            {n === 0 ? (
                              <span className="ml-2">
                                <Badge tone="bad">Sold out</Badge>
                              </span>
                            ) : n <= 3 ? (
                              <span className="ml-2">
                                <Badge tone="warn">Low</Badge>
                              </span>
                            ) : null}
                          </td>
                          <td>
                            <Stepper value={n} label={`Stock for ${s}`} onChange={(v) => setForm((f) => ({ ...f, stock: { ...f.stock, [s]: v } }))} />
                          </td>
                          <td className="r">
                            <button type="button" className="adm-icon-btn" onClick={() => removeSize(s)} aria-label={`Remove size ${s}`}>
                              <AIcon name="trash" size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Search engine listing">
            <div className="rounded-[10px] bg-[#f6f7f9] p-3">
              <p className="truncate text-[12px] text-[#4a525c]">smadi.store › product › {meta.slug ?? 'new-product'}</p>
              <p className="mt-0.5 truncate text-[16px] text-[#1a3fd6]">{seoTitle}</p>
              <p className="mt-0.5 line-clamp-2 text-[12.5px] text-[#4a525c]">{seoDesc}</p>
            </div>
            <label htmlFor="p-seo-t" className="adm-label mt-4">
              Page title <span className="num font-normal text-[#8a939e]">{form.seoTitle.length}/70</span>
            </label>
            <input id="p-seo-t" className="adm-input" maxLength={70} value={form.seoTitle} onChange={(e) => set('seoTitle', e.target.value)} placeholder={form.name} />
            <label htmlFor="p-seo-d" className="adm-label mt-4">
              Meta description <span className="num font-normal text-[#8a939e]">{form.seoDescription.length}/320</span>
            </label>
            <textarea id="p-seo-d" className="adm-textarea !min-h-[80px]" maxLength={320} value={form.seoDescription} onChange={(e) => set('seoDescription', e.target.value)} placeholder={form.short} />
          </Card>
        </div>

        <div className="space-y-3">
          <Card title="Status">
            <select className="adm-select" value={form.status} onChange={(e) => set('status', e.target.value as ProductInput['status'])} aria-label="Status">
              {PRODUCT_STATUS.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
            <p className="adm-help">
              {form.status === 'active' ? 'Shown in the online store.' : form.status === 'draft' ? 'Hidden from the store while you work on it.' : 'Hidden and kept for the record.'}
            </p>
            <div className="adm-sep mt-3 flex items-center justify-between gap-3 pt-3">
              <div>
                <p className="font-medium">Coming soon</p>
                <p className="text-[12px] text-[#66707c]">Show it in the store, but it can’t be ordered yet</p>
              </div>
              <Switch checked={form.comingSoon} onChange={(v) => set('comingSoon', v)} label="Coming soon" />
            </div>
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[12.5px] text-[#4a525c]" data-testid="store-availability">
              In the store:{' '}
              {form.comingSoon ? <Badge tone="info">Coming soon</Badge> : units === 0 ? <Badge tone="bad">Out of stock</Badge> : <Badge tone="good">In stock</Badge>}
            </p>
            <p className="adm-help">
              {form.comingSoon
                ? units === 0
                  ? 'No stock yet: it shows as Coming soon until you turn this off.'
                  : `${units} in stock, held back as Coming soon until you turn this off.`
                : 'Out of stock shows by itself when every size is at 0.'}
            </p>
          </Card>

          <Card title="Product organisation">
            <label htmlFor="p-sport" className="adm-label">
              Sport
            </label>
            <select
              id="p-sport"
              className="adm-select"
              value={form.sport}
              onChange={(e) => {
                const s = sports.find((x) => x.slug === e.target.value);
                setForm((f) => ({ ...f, sport: e.target.value as ProductInput['sport'], sub: s?.subs[0]?.slug ?? '' }));
              }}
            >
              {sports.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
            <label htmlFor="p-sub" className="adm-label mt-3">
              Category
            </label>
            <select id="p-sub" className="adm-select" value={form.sub} onChange={(e) => set('sub', e.target.value)} {...inv('sub')}>
              {subs.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
            {err('sub')}
            <label htmlFor="p-vendor" className="adm-label mt-3">
              Vendor
            </label>
            <select id="p-vendor" className="adm-select" value={form.brand} onChange={(e) => set('brand', e.target.value)} {...inv('brand')}>
              {!vendors.some((v) => v.id === form.brand) && <option value={form.brand}>{form.brand}</option>}
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            {err('brand')}
            <label htmlFor="p-tag" className="adm-label mt-3">
              Tags
            </label>
            <input
              id="p-tag"
              className="adm-input"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ',') && tag.trim()) {
                  e.preventDefault();
                  if (!form.tags.includes(tag.trim().toLowerCase())) set('tags', [...form.tags, tag.trim().toLowerCase()]);
                  setTag('');
                }
              }}
              placeholder="Type a tag, press Enter"
            />
            {form.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {form.tags.map((t) => (
                  <span key={t} className="adm-badge" data-plain>
                    {t}
                    <button type="button" onClick={() => set('tags', form.tags.filter((x) => x !== t))} aria-label={`Remove tag ${t}`} className="-mr-1 opacity-60 hover:opacity-100">
                      <AIcon name="close" size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </Card>

          <Card title="Merchandising">
            {(
              [
                ['bestSeller', 'Best seller', 'Listed under Best sellers'],
                ['isNew', 'New', 'Shows the New badge'],
                ['featured', 'Featured', 'Picked first in its sport'],
              ] as const
            ).map(([k, label, help]) => (
              <div key={k} className="flex items-center justify-between gap-3 py-1.5">
                <div>
                  <p className="font-medium" id={`lbl-${k}`}>
                    {label}
                  </p>
                  <p className="text-[12px] text-[#66707c]">{help}</p>
                </div>
                <Switch checked={form[k]} onChange={(v) => set(k, v)} label={label} />
              </div>
            ))}
          </Card>

          <Card title="Colours" action={<span className="text-[12px] text-[#66707c]">{(form.colors ?? []).length ? `${(form.colors ?? []).length} shown` : 'None shown'}</span>}>
            <p className="text-[12.5px] text-[#66707c]">
              The colours a customer can choose. With none, nothing about colour shows on the website.
            </p>
            <ul className="mt-3 grid gap-2">
              {(form.colors ?? []).map((c, i) => (
                <li key={i} className="flex items-center gap-2">
                  <input
                    type="color"
                    value={c.swatch}
                    onChange={(e) => set('colors', (form.colors ?? []).map((x, k) => (k === i ? { ...x, swatch: e.target.value.toUpperCase() } : x)))}
                    className="h-9 w-11 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                    aria-label={`Colour ${i + 1}: swatch`}
                  />
                  <input
                    className="adm-input"
                    value={c.name}
                    maxLength={40}
                    placeholder="e.g. Black / gold"
                    onChange={(e) => set('colors', (form.colors ?? []).map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))}
                    aria-label={`Colour ${i + 1}: name`}
                    aria-invalid={errors[`colors.${i}.name`] ? true : undefined}
                  />
                  <button type="button" className="adm-icon-btn shrink-0" aria-label={`Remove colour ${c.name || i + 1}`} onClick={() => set('colors', (form.colors ?? []).filter((_, k) => k !== i))}>
                    <AIcon name="trash" size={15} />
                  </button>
                </li>
              ))}
            </ul>
            {err('colors') ?? (Object.keys(errors).some((k) => k.startsWith('colors.')) ? <p className="adm-error">Name every colour</p> : null)}
            <button
              type="button"
              className="adm-btn mt-2"
              disabled={(form.colors ?? []).length >= 12}
              onClick={() => set('colors', [...(form.colors ?? []), { name: '', swatch: '#0F1216' }])}
            >
              <AIcon name="plus" size={15} /> Add a colour
            </button>
          </Card>

          <PicksCard slug={meta.slug} picks={form.picks ?? []} onChange={(v) => set('picks', v)} />

          {!isNew && (
            <Card title="More">
              <div className="grid gap-2">
                {meta.live && form.status === 'active' ? (
                  <a href={`/product/${meta.slug}`} target="_blank" rel="noopener" className="adm-btn justify-start">
                    <AIcon name="external" size={15} /> View in store
                  </a>
                ) : null}
                <button
                  type="button"
                  className="adm-btn justify-start"
                  disabled={pending || !writable}
                  onClick={() =>
                    start(async () => {
                      const res = await duplicateProduct(meta.slug!);
                      if (res.ok) {
                        toast('Duplicated as a draft');
                        router.push(`/admin/products/${res.data!.slug}`);
                      } else toast(res.error, 'bad');
                    })
                  }
                >
                  <AIcon name="copy" size={15} /> Duplicate
                </button>
                <button type="button" className="adm-btn adm-btn-danger justify-start" disabled={pending || !writable} onClick={() => setConfirmDelete(true)}>
                  <AIcon name="trash" size={15} /> Delete product
                </button>
              </div>
            </Card>
          )}
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="adm-btn adm-btn-primary" onClick={save} disabled={pending || !writable || (!dirty && !isNew)}>
          {pending ? 'Saving…' : isNew ? 'Create product' : 'Save'}
        </button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${form.name}?`}
        body="It is removed from the store and the admin. To hide it but keep it, set its status to Archived instead."
        confirm="Delete product"
        danger
        busy={pending}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() =>
          start(async () => {
            const res = await deleteProduct(meta.slug!);
            if (res.ok) {
              setBase(JSON.stringify({ form, prices }));
              toast('Product deleted');
              router.replace('/admin/products');
            } else toast(res.error, 'bad');
          })
        }
      />
    </>
  );
}

function MediaSlot({ label, src, onFile, disabled }: { label: string; src: string | null; onFile: (f: File | undefined) => void; disabled: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [broken, setBroken] = useState(false);
  const show = src && !broken;
  return (
    <div>
      <button
        type="button"
        className="adm-dropzone w-full"
        data-empty={show ? undefined : ''}
        data-drag={drag ? '' : undefined}
        disabled={disabled}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          setBroken(false);
          onFile(e.dataTransfer.files[0]);
        }}
        aria-label={`${label}: ${show ? 'replace' : 'add'} image`}
      >
        {show ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin preview of the stored file, cache-busted after upload
          <img src={src} alt="" className="h-full w-full object-contain p-3" onError={() => setBroken(true)} />
        ) : (
          <span className="grid place-items-center gap-1 text-[#66707c]">
            <AIcon name="upload" />
            <span className="text-[12px] font-medium">Add image</span>
          </span>
        )}
      </button>
      <p className="mt-1.5 text-[12px] text-[#66707c]">{label}</p>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          setBroken(false);
          onFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}

type PickEntry = Pick<SearchIndexEntry, 'slug' | 'name' | 'brandName' | 'image'> & SearchIndexEntry;

/** "Complete the look": up to 3 products the shop shows with this one (empty: chosen automatically). */
function PicksCard({ slug, picks, onChange }: { slug?: string; picks: string[]; onChange: (v: string[]) => void }) {
  const [index, setIndex] = useState<PickEntry[] | null>(null);
  const [q, setQ] = useState('');
  const load = () => {
    if (index) return;
    fetch('/api/search-index')
      .then((r) => (r.ok ? (r.json() as Promise<PickEntry[]>) : []))
      .then(setIndex)
      .catch(() => setIndex([]));
  };
  const bySlug = useMemo(() => new Map((index ?? []).map((e) => [e.slug, e])), [index]);
  const results = useMemo(() => (index && q.trim() ? rankSearch(index, q, 6).filter((e) => e.slug !== slug && !picks.includes(e.slug)) : []), [index, q, slug, picks]);
  return (
    <Card title="Complete the look">
      <p className="text-[12.5px] text-[#66707c]">
        Shown under this product. Leave empty and the store picks matching products itself; as orders come in, what customers really buy together slowly
        takes over.
      </p>
      {picks.length > 0 && (
        <ul className="mt-3 grid gap-2">
          {picks.map((p, i) => (
            <li key={p} className="flex items-center gap-2 text-[13px]">
              <span className="num w-4 text-[#8a939e]">{i + 1}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {bySlug.get(p) ? <img src={bySlug.get(p)!.image} alt="" className="h-8 w-8 shrink-0 rounded bg-[#f3f4f6] object-contain" /> : null}
              <span className="min-w-0 flex-1 truncate">{bySlug.get(p)?.name ?? p}</span>
              <button type="button" className="adm-icon-btn shrink-0" aria-label="Remove" onClick={() => onChange(picks.filter((x) => x !== p))}>
                <AIcon name="close" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {picks.length < 3 && (
        <div className="relative mt-3">
          <input className="adm-input" value={q} placeholder="Search a product to add" onFocus={load} onChange={(e) => setQ(e.target.value)} aria-label="Search a product to show with this one" />
          {results.length > 0 && (
            <ul className="adm-pick-list">
              {results.map((e) => (
                <li key={e.slug}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange([...picks, e.slug]);
                      setQ('');
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={e.image} alt="" />
                    <span className="min-w-0 flex-1 truncate">{e.name}</span>
                    <span className="text-[11px] text-[#8a939e]">{e.brandName}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
