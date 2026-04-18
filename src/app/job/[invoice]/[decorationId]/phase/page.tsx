'use client';

import { use, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BrandHeader } from '@/components/BrandHeader';
import { ACTIVE_CLOCK_KEY, type ActiveClockPayload } from '@/lib/time';
import { PHASES, PHASE_COLORS, isValidPress, type Phase } from '@/lib/config';

export default function PhasePickerPage({
  params,
}: {
  params: Promise<{ invoice: string; decorationId: string }>;
}) {
  const { invoice, decorationId } = use(params);
  const decIdNum = Number(decorationId);
  const router = useRouter();
  const sp = useSearchParams();
  const pressParam = sp.get('press') ?? '';
  const press = isValidPress(pressParam) ? pressParam : null;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Phase | null>(null);

  async function start(phase: Phase) {
    if (!press) {
      setError('Pick a press on the previous screen');
      return;
    }
    setError(null);

    // If another clock is already running, warn
    try {
      const raw = localStorage.getItem(ACTIVE_CLOCK_KEY);
      if (raw) {
        const existing = JSON.parse(raw) as ActiveClockPayload;
        const ok = window.confirm(
          `A clock is already running for invoice ${existing.invoice} (${existing.phase}).\n\nStop it manually first, or continue to start a new one anyway?`,
        );
        if (!ok) return;
      }
    } catch {
      /* ignore */
    }

    setBusy(phase);
    try {
      const res = await fetch('/api/clock/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice,
          decorationId: decIdNum,
          press,
          phase,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Failed to start');
        return;
      }
      const payload: ActiveClockPayload = {
        entryId: data.entry.id,
        invoice,
        decorationId: decIdNum,
        decorationLabel: `#${decIdNum}`,
        press,
        phase,
        startedAt: data.entry.startedAt,
        pausedAt: null,
        pausedDurationSec: 0,
      };
      localStorage.setItem(ACTIVE_CLOCK_KEY, JSON.stringify(payload));
      router.push('/active');
    } catch (err: any) {
      setError(err?.message ?? 'Network error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="min-h-screen flex flex-col">
      <BrandHeader
        crumbs={[
          `Invoice ${invoice}`,
          press ?? '(no press)',
          `Decoration #${decIdNum}`,
        ]}
      />
      <div className="p-4 flex flex-col gap-4 flex-1">
        <div className="text-craft-grey text-sm">Pick a phase to start the clock</div>
        {!press && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
            No press selected. Go back and choose Roq Eco or Roq You first.
          </div>
        )}

        <div className="flex-1 flex flex-col gap-4 justify-center">
          {PHASES.map((phase) => (
            <button
              key={phase}
              onClick={() => start(phase)}
              disabled={!press || busy !== null}
              className={
                'h-32 rounded-2xl shadow-lg text-4xl font-extrabold uppercase tracking-wide active:scale-[0.98] transition disabled:opacity-60 ' +
                PHASE_COLORS[phase]
              }
            >
              {busy === phase ? 'Starting\u2026' : phase}
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
            {error}
          </div>
        )}
      </div>
    </main>
  );
}
