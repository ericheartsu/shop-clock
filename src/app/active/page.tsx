'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BrandHeader } from '@/components/BrandHeader';
import {
  ACTIVE_CLOCK_KEY,
  formatDuration,
  type ActiveClockPayload,
} from '@/lib/time';

export default function ActivePage() {
  const router = useRouter();
  const [active, setActive] = useState<ActiveClockPayload | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ACTIVE_CLOCK_KEY);
      if (!raw) {
        router.replace('/');
        return;
      }
      const payload = JSON.parse(raw) as ActiveClockPayload;
      setActive(payload);
    } catch {
      router.replace('/');
    }
  }, [router]);

  useEffect(() => {
    if (!active) return;
    const started = new Date(active.startedAt).getTime();
    const update = () => setElapsed((Date.now() - started) / 1000);
    update();
    tickRef.current = setInterval(update, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [active]);

  async function stop() {
    if (!active) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/clock/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryId: active.entryId,
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Failed to stop');
        return;
      }
      localStorage.removeItem(ACTIVE_CLOCK_KEY);
      router.replace('/');
    } catch (err: any) {
      setError(err?.message ?? 'Network error');
    } finally {
      setBusy(false);
    }
  }

  if (!active) return null;

  return (
    <main className="min-h-screen flex flex-col bg-craft-black text-white">
      <BrandHeader crumbs={[`Invoice ${active.invoice}`, active.press, active.phase]} />

      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-6">
        <div className="text-center">
          <div className="text-xs uppercase tracking-widest text-white/60">
            {active.phase}
          </div>
          <div className="text-lg font-bold text-white/80 mt-1">
            {active.press} {'\u2022'} Invoice {active.invoice}
          </div>
        </div>

        <div className="text-center">
          <div
            className="font-extrabold tabular-nums leading-none"
            style={{ fontSize: 'clamp(6rem, 22vw, 14rem)' }}
          >
            {formatDuration(elapsed)}
          </div>
        </div>

        <label className="block w-full max-w-md">
          <span className="text-xs uppercase tracking-widest text-white/60">
            Notes (optional)
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Paper jam, ink swap, customer change\u2026"
            className="mt-1 w-full rounded-xl bg-white/10 border-2 border-white/20 p-3 text-lg text-white placeholder:text-white/40"
          />
        </label>

        {error && (
          <div className="rounded-lg bg-red-500/20 border border-red-400 text-red-100 px-3 py-2 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={stop}
          disabled={busy}
          className="w-full max-w-md h-24 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-4xl font-extrabold shadow-2xl active:scale-[0.98] disabled:opacity-60"
        >
          {busy ? 'STOPPING\u2026' : 'STOP'}
        </button>
      </div>
    </main>
  );
}
