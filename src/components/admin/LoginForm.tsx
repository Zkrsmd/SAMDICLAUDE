'use client';
import { useActionState, useState } from 'react';
import { login } from '@/app/admin/actions';

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, null);
  const [show, setShow] = useState(false);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="adm-pw" className="adm-label">
          Password
        </label>
        <div className="relative">
          <input
            id="adm-pw"
            name="password"
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            required
            autoFocus
            className="adm-input pr-16"
            aria-invalid={state && !state.ok ? true : undefined}
            aria-describedby={state && !state.ok ? 'adm-pw-error' : undefined}
          />
          <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm absolute right-1 top-1/2 -translate-y-1/2" onClick={() => setShow((s) => !s)}>
            {show ? 'Hide' : 'Show'}
          </button>
        </div>
        {state && !state.ok && (
          <p id="adm-pw-error" role="alert" className="adm-error">
            {state.error}
          </p>
        )}
      </div>
      <button type="submit" className="adm-btn adm-btn-primary h-10 w-full" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
