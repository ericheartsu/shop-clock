'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BrandHeader } from '@/components/BrandHeader';
import { ACTIVE_CLOCK_KEY, type ActiveClockPayload } from '@/lib/time';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '<'];

export default function Home() {
  const router = useRouter();
  const [invoice, setInvoice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState<ActiveClockPayload | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ACTIVE_CLOCK_KEY);
      if (raw) setActive(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  function press(key: string) {
    setError(null);
    if (key === 'C') {
      setInvoice('');
    } else if (key === '<') {
      setInvoice((v) => v.slice(0, -1));
    } else {
      setInvoice((v) => (v + key).slice(0, 10));
    }
    // keep focus on the hidden-but-real input so keyboard users can keep typing
    inputRef.current?.focus();
  }

  async function lookup() {
    if (!invoice) {
      setError('Enter an invoice number');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/jobs/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Lookup failed');
        return;
      }
      router.push(`/job/${encodeURIComponent(invoice)}`);
    } catch (err: any) {
      setError(err?.message ?? 'Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col">
      <BrandHeader />

      {active && (
        <button
          onClick={() => router.push('/active')}
          className="mx-4 mt-4 rounded-xl bg-craft-lime text-craft-black font-bold py-4 text-lg shadow active:scale-[0.99]"
        >
          Clock running — Invoice {active.invoice} · {active.phase} · Tap to resume
        </button>
      )}

      <div className="flex-1 flex flex-col p-4 gap-4">
        <label className="block">
          <span className="text-sm font-semibold text-craft-grey">
            Printavo Invoice #
          </span>
          {/*
            Real <input> so physical keyboards (laptops) and native iOS/Android
            numeric keyboards work. Visually styled to match the big-digit
            display; the on-screen keypad below is still available for tablet
            users who don't want to pop the soft keyboard.
          */}
          <input
            ref={inputRef}
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            autoFocus
            value={invoice}
            onChange={(e) => {
              // strip everything that isn't a digit, cap at 10
              const cleaned = e.target.value.replace(/\D/g, '').slice(0, 10);
              setInvoice(cleaned);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                lookup();
              }
            }}
            placeholder="——"
            aria-label="Printavo invoice number"
            className="mt-1 w-full rounded-2xl bg-white border-2 border-craft-grey/20 px-4 py-5 text-center shadow-inner text-5xl font-extrabold tracking-widest text-craft-black outline-none focus:border-craft-cyan placeholder:text-craft-grey/40"
          />
        </label>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          {KEYS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => press(k)}
              className={
                'h-20 rounded-xl text-3xl font-bold shadow-sm active:scale-95 transition ' +
                (k === 'C'
                  ? 'bg-craft-grey/20 text-craft-grey'
                  : k === '<'
                  ? 'bg-craft-grey/20 text-craft-grey'
                  : 'bg-white border border-craft-grey/20 text-craft-black')
              }
            >
              {k === '<' ? '\u232B' : k}
            </button>
          ))}
        </div>

        <button
          onClick={lookup}
          disabled={loading}
          className="h-20 rounded-2xl bg-craft-cyan text-white text-2xl font-extrabold shadow-md active:scale-[0.99] disabled:opacity-60"
        >
          {loading ? 'LOOKING UP\u2026' : 'LOOKUP'}
        </button>
      </div>
    </main>
  );
}
