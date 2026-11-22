'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { updateCustomer } from '@/app/admin/actions';
import { Card } from './ui';
import { toast } from './client';

const SUGGESTED = ['VIP', 'Repeat buyer', 'Refused a parcel', 'Call before 6 pm', 'Wholesale'];

/** Edit a customer: name and phone (changed on all their orders), a private note and tags. */
export function CustomerEditor({ phone, name, profile, writable }: { phone: string; name: string; profile: { note: string; tags: string[] }; writable: boolean }) {
  const router = useRouter();
  const [v, setV] = useState({ name, phone, note: profile.note, tags: profile.tags });
  const [tag, setTag] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const addTag = (t: string) => {
    const x = t.trim().slice(0, 24);
    if (x && !v.tags.includes(x) && v.tags.length < 10) setV((s) => ({ ...s, tags: [...s.tags, x] }));
    setTag('');
  };
  const err = (k: string) => (errors[k] ? <span className="mt-1 block text-[12px] text-[#c4321f]">{errors[k]}</span> : null);
  return (
    <Card title="Edit customer">
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const words = v.name.trim().split(/\s+/).filter(Boolean);
          start(async () => {
            const res = await updateCustomer(phone, { firstName: words[0] ?? '', lastName: words.slice(1).join(' '), phone: v.phone }, { note: v.note, tags: v.tags });
            if (res.ok) {
              toast('Customer saved');
              setErrors({});
              const next = res.data?.id;
              if (next && next !== `tel:${phone}`) router.replace(`/admin/customers/${encodeURIComponent(next)}`);
              else router.refresh();
            } else {
              const f = res.fields ?? {};
              setErrors({ ...f, name: f.firstName ?? f.lastName ?? '' });
              toast(res.error, 'bad');
            }
          });
        }}
      >
        <label className="grid gap-1">
          <span className="text-[12.5px] font-semibold text-[#4a525c]">Full name</span>
          <input className="adm-input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
          {err('name')}
        </label>
        <label className="grid gap-1">
          <span className="text-[12.5px] font-semibold text-[#4a525c]">Phone</span>
          <input className="adm-input num" inputMode="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />
          {err('phone')}
        </label>
        <p className="-mt-1 text-[12px] text-[#66707c]">Name and phone change on all of this customer’s orders.</p>
        <label className="grid gap-1">
          <span className="text-[12.5px] font-semibold text-[#4a525c]">Private note</span>
          <textarea className="adm-input min-h-[80px]" maxLength={2000} value={v.note} placeholder="e.g. prefers stop desk, size L" onChange={(e) => setV({ ...v, note: e.target.value })} />
        </label>
        <div className="grid gap-1.5">
          <span className="text-[12.5px] font-semibold text-[#4a525c]">Tags</span>
          <div className="flex flex-wrap gap-1.5">
            {v.tags.map((t) => (
              <button key={t} type="button" className="adm-chip" onClick={() => setV({ ...v, tags: v.tags.filter((x) => x !== t) })} aria-label={`Remove tag ${t}`}>
                {t} ×
              </button>
            ))}
          </div>
          <input
            className="adm-input"
            value={tag}
            placeholder="Add a tag and press Enter"
            onChange={(e) => setTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTag(tag);
              }
            }}
          />
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED.filter((s) => !v.tags.includes(s)).map((s) => (
              <button key={s} type="button" className="adm-chip opacity-70 hover:opacity-100" onClick={() => addTag(s)}>
                + {s}
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end">
          <button type="submit" className="adm-btn adm-btn-primary" disabled={pending || !writable}>
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Card>
  );
}
