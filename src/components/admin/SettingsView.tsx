'use client';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { importStore, resetStore } from '@/app/admin/actions';
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
