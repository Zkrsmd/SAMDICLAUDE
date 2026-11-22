'use client';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { importStore, resetStore, saveSiteSettings } from '@/app/admin/actions';
import type { SiteSettings } from '@/lib/validation/admin';
import { AIcon } from './ui';
import { ConfirmDialog, toast } from './client';

export function SettingsView({ writable }: { writable: boolean }) {
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<null | 'reset' | { json: string; name: string }>(null);
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <a href="/api/admin/export" className="adm-btn" download>
        <AIcon name="download" size={15} /> Export
      </a>
      <button type="button" className="adm-btn" disabled={!writable || pending} onClick={() => file.current?.click()}>
        <AIcon name="upload" size={15} /> Import
      </button>
      <button type="button" className="adm-btn adm-btn-danger" disabled={!writable || pending} onClick={() => setConfirm('reset')}>
        <AIcon name="trash" size={15} /> Reset all changes
      </button>
      <input
        ref={file}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        tabIndex={-1}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          if (f.size > 2_000_000) return toast('That file is too large', 'bad');
          setConfirm({ json: await f.text(), name: f.name });
        }}
      />
      <ConfirmDialog
        open={confirm !== null}
        title={confirm === 'reset' ? 'Reset all admin changes?' : 'Import this store file?'}
        body={
          confirm === 'reset'
            ? 'Every edit, added product, deletion and order change goes back to the original catalogue. Export first if you may want them back. Uploaded photos stay.'
            : `“${typeof confirm === 'object' && confirm ? confirm.name : ''}” replaces every current admin change.`
        }
        confirm={confirm === 'reset' ? 'Reset' : 'Import'}
        danger={confirm === 'reset'}
        busy={pending}
        onClose={() => setConfirm(null)}
        onConfirm={() =>
          start(async () => {
            const res = confirm === 'reset' ? await resetStore() : confirm ? await importStore(confirm.json) : null;
            if (!res) return;
            if (res.ok) {
              toast(confirm === 'reset' ? 'Store reset' : 'Imported');
              setConfirm(null);
              router.refresh();
            } else toast(res.error, 'bad');
          })
        }
      />
    </div>
  );
}

const LINKS: { id: keyof SiteSettings; label: string; placeholder: string }[] = [
  { id: 'facebook', label: 'Facebook', placeholder: 'https://www.facebook.com/strykealgeria' },
  { id: 'instagram', label: 'Instagram', placeholder: 'https://www.instagram.com/strykealgeria' },
  { id: 'tiktok', label: 'TikTok', placeholder: 'https://www.tiktok.com/@strykealgeria' },
  { id: 'email', label: 'E-mail (optional)', placeholder: 'contact@…' },
];

/** The footer's social links and e-mail. An empty field hides that link. */
export function SiteLinksForm({ initial }: { initial: SiteSettings }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveSiteSettings(v);
          if (res.ok) {
            setErrors({});
            toast('Links saved — they show in the footer now');
            router.refresh();
          } else {
            setErrors(res.fields ?? {});
            toast(res.error, 'bad');
          }
        });
      }}
    >
      {LINKS.map((l) => (
        <label key={l.id} className="grid gap-1 sm:grid-cols-[140px_1fr] sm:items-center sm:gap-3">
          <span className="text-[13px] font-semibold text-[#4a525c]">{l.label}</span>
          <span>
            <input
              className="adm-input"
              type={l.id === 'email' ? 'email' : 'url'}
              value={v[l.id]}
              placeholder={l.placeholder}
              onChange={(e) => setV((x) => ({ ...x, [l.id]: e.target.value.trim() }))}
              aria-invalid={errors[l.id] ? true : undefined}
            />
            {errors[l.id] && <span className="mt-1 block text-[12px] text-[#c4321f]">{errors[l.id]}</span>}
          </span>
        </label>
      ))}
      <div className="flex justify-end">
        <button type="submit" className="adm-btn adm-btn-primary" disabled={pending}>
          {pending ? 'Saving…' : 'Save links'}
        </button>
      </div>
    </form>
  );
}
