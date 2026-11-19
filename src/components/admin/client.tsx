'use client';
import { useEffect, useRef, useState } from 'react';

/* Client-side admin helpers: toasts, a confirm dialog and a switch. */

type ToastMsg = { id: number; text: string; tone?: 'bad' };
const EVT = 'adm-toast';
let seq = 0;

/** Show a short message at the bottom of the screen. */
export function toast(text: string, tone?: 'bad') {
  window.dispatchEvent(new CustomEvent<ToastMsg>(EVT, { detail: { id: ++seq, text, tone } }));
}

export function Toaster() {
  const [list, setList] = useState<ToastMsg[]>([]);
  useEffect(() => {
    const on = (e: Event) => {
      const t = (e as CustomEvent<ToastMsg>).detail;
      setList((l) => [...l.slice(-2), t]);
      window.setTimeout(() => setList((l) => l.filter((x) => x.id !== t.id)), t.tone ? 6000 : 3200);
    };
    window.addEventListener(EVT, on);
    return () => window.removeEventListener(EVT, on);
  }, []);
  return (
    <div className="adm-toasts" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className="adm-toast" data-tone={t.tone}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

/** A modal "are you sure?" built on <dialog> (focus trap, Escape and backdrop come from the browser). */
export function ConfirmDialog({
  open,
  title,
  body,
  confirm,
  danger,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirm: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="adm-dialog" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} aria-labelledby="adm-confirm-title">
      <div className="p-5">
        <h2 id="adm-confirm-title" className="text-[16px] font-bold">
          {title}
        </h2>
        <div className="mt-2 text-[#4a525c]">{body}</div>
      </div>
      <div className="adm-sep flex justify-end gap-2 bg-[#f7f8fa] px-5 py-3">
        <button type="button" className="adm-btn" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className={`adm-btn ${danger ? 'adm-btn-primary !bg-[#b42318]' : 'adm-btn-primary'}`} onClick={onConfirm} disabled={busy}>
          {busy ? 'Working…' : confirm}
        </button>
      </div>
    </dialog>
  );
}

export function Switch({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; id?: string }) {
  return <button id={id} type="button" role="switch" aria-checked={checked} aria-label={label} className="adm-switch" onClick={() => onChange(!checked)} />;
}

/** Warn before leaving the page with unsaved changes. */
export function useLeaveGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const on = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', on);
    return () => window.removeEventListener('beforeunload', on);
  }, [dirty]);
}

/** A whole-number stepper (−  12  +) for stock. */
export function Stepper({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="inline-flex items-center rounded-[9px] shadow-[inset_0_0_0_1px_rgb(15_18_22/0.16)]">
      <button type="button" className="grid h-8 w-8 place-items-center text-[#4a525c] hover:text-ink" onClick={() => onChange(Math.max(0, value - 1))} aria-label={`${label}: one less`}>
        −
      </button>
      <input
        className="num h-8 w-14 bg-transparent text-center outline-none"
        inputMode="numeric"
        value={value}
        aria-label={label}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/\D/g, ''));
          onChange(Number.isFinite(n) ? Math.min(100000, n) : 0);
        }}
      />
      <button type="button" className="grid h-8 w-8 place-items-center text-[#4a525c] hover:text-ink" onClick={() => onChange(Math.min(100000, value + 1))} aria-label={`${label}: one more`}>
        +
      </button>
    </div>
  );
}
