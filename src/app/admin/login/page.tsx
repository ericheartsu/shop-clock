'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BrandHeader } from '@/components/BrandHeader';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get('from') || '/admin/operators';
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? 'Sign-in failed');
        return;
      }
      router.replace(from);
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? 'Network error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col bg-craft-black text-white">
      <BrandHeader crumbs={['Admin', 'Sign in']} />
      <div className="flex-1 flex items-center justify-center p-4">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-sm rounded-2xl bg-white text-craft-black shadow-2xl p-6 flex flex-col gap-4"
        >
          <div>
            <div className="text-craft-grey text-xs font-semibold uppercase tracking-wide">
              Admin area
            </div>
            <div className="text-2xl font-extrabold">Sign in</div>
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-craft-grey">Password</span>
            <input
              autoFocus
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border-2 border-craft-grey/20 px-3 py-3 text-lg"
            />
          </label>
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={busy || !password}
            className="h-12 rounded-xl bg-craft-cyan text-white font-extrabold text-lg active:scale-[0.99] disabled:opacity-60"
          >
            {busy ? 'Signing in\u2026' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
