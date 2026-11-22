'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { formatPrice } from '@/lib/format';
import { AIcon } from './ui';
import { toast } from './client';

const KEY = 'stryke-admin-alerts';
const EVERY = 15_000;

type Latest = { order: { id: string; number: number; name: string; total: number; items: number } | null; waiting: number };

/**
 * The till sound: a "ka-ching" made on the spot with the Web Audio API (no sound file) — a short
 * metallic click for the drawer, then two bright bell notes ringing out.
 */
function chaChing(ctx: AudioContext) {
  const t0 = ctx.currentTime + 0.02;
  const out = ctx.createGain();
  out.gain.value = 0.55;
  out.connect(ctx.destination);
  // the drawer's click: a very short burst of filtered noise
  const len = Math.floor(ctx.sampleRate * 0.06);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 2500;
  noise.connect(hp).connect(out);
  noise.start(t0);
  // the bell: two strikes, each a few inharmonic partials that ring and fade
  const strike = (at: number, base: number, level: number) => {
    for (const [ratio, amp, decay] of [
      [1, 1, 1.1],
      [2.76, 0.45, 0.6],
      [5.4, 0.22, 0.35],
      [8.93, 0.1, 0.2],
    ] as const) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = base * ratio;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(level * amp, at + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
      o.connect(g).connect(out);
      o.start(at);
      o.stop(at + decay + 0.05);
    }
  };
  strike(t0 + 0.07, 1318.5, 0.32); // E6
  strike(t0 + 0.19, 1760, 0.36); // A6
}

/**
 * New-order alert for the admin (top bar): while any admin page is open, it checks every 15 s for
 * a new website order; when one arrives it plays a till "ka-ching", shows a message (and a system
 * notification when allowed), puts the count in the tab title and refreshes the page's data.
 * Browsers only allow sound after a click, so the bell button turns it on (remembered on this device).
 */
export function OrderAlerts() {
  const router = useRouter();
  const [on, setOn] = useState(false);
  const [ring, setRing] = useState(false);
  const ctx = useRef<AudioContext | null>(null);
  const last = useRef<number | null>(null);
  const title = useRef('');

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(KEY) === 'on') setOn(true);
    } catch {
      /* private mode */
    }
  }, []);

  useEffect(() => {
    let stop = false;
    const check = async () => {
      if (document.hidden && !on) return;
      try {
        const r = await fetch('/api/admin/orders/latest', { cache: 'no-store' });
        if (!r.ok) return;
        const d = (await r.json()) as Latest;
        if (stop) return;
        const n = d.order?.number ?? 0;
        if (!title.current) title.current = document.title.replace(/^\(\d+\) /, '');
        document.title = d.waiting ? `(${d.waiting}) ${title.current}` : title.current;
        if (last.current !== null && n > last.current && d.order) {
          const o = d.order;
          const text = `New order #${o.number} · ${o.name || 'customer'} · ${formatPrice(o.total)}`;
          toast(text);
          setRing(true);
          window.setTimeout(() => setRing(false), 2000);
          if (on) {
            if (ctx.current?.state === 'suspended') await ctx.current.resume().catch(() => undefined);
            if (ctx.current) chaChing(ctx.current);
            if ('Notification' in window && Notification.permission === 'granted') {
              const note = new Notification('STRYKE · new order', { body: text, tag: `order-${o.number}`, icon: '/icon.svg' });
              note.onclick = () => {
                window.focus();
                router.push(`/admin/orders/${o.id}`);
              };
            }
          }
          router.refresh();
        }
        last.current = n;
      } catch {
        /* offline for a moment: try again next time */
      }
    };
    void check();
    const t = window.setInterval(check, EVERY);
    const vis = () => void check();
    document.addEventListener('visibilitychange', vis);
    return () => {
      stop = true;
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [on, router]);

  const toggle = async () => {
    const next = !on;
    if (next) {
      // sound needs a click to start; play it once so the owner hears what it sounds like
      ctx.current ??= new AudioContext();
      await ctx.current.resume().catch(() => undefined);
      chaChing(ctx.current);
      if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission().catch(() => undefined);
      toast('Order alerts on — you’ll hear this when an order comes in');
    } else toast('Order alerts off');
    setOn(next);
    try {
      localStorage.setItem(KEY, next ? 'on' : 'off');
    } catch {
      /* private mode */
    }
  };

  // after a reload the sound is "on" but the browser still wants one click before playing
  useEffect(() => {
    if (!on || ctx.current) return;
    const unlock = () => {
      ctx.current ??= new AudioContext();
      void ctx.current.resume().catch(() => undefined);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [on]);

  return (
    <button
      type="button"
      className="adm-icon-btn adm-alerts text-white hover:!bg-white/10"
      data-on={on ? '' : undefined}
      data-ring={ring ? '' : undefined}
      aria-pressed={on}
      aria-label={on ? 'New-order sound is on — turn it off' : 'Turn on the new-order sound'}
      title={on ? 'New-order sound: on' : 'New-order sound: off'}
      onClick={toggle}
      data-testid="order-alerts"
    >
      <AIcon name={on ? 'bell' : 'bell-off'} />
    </button>
  );
}
