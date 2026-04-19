'use client';

import { use, useEffect, useRef, useState } from 'react';
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
  const [busy, setBusy] = useState(false);

  // PIN gate state. When a phase is picked, we pop the pad; once the PIN
  // resolves to a valid Operator, we fire /api/clock/start.
  const [pendingPhase, setPendingPhase] = useState<Phase | null>(null);
  const [pin, setPin] = useState('');
  const pinInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (pendingPhase) {
      // Small delay so the modal animates in before autofocus fights it
      setTimeout(() => pinInputRef.current?.focus(), 50);
    }
  }, [pendingPhase]);

  function openPinGate(phase: Phase) {
    if (!press) {
      setError('Pick a press on the previous screen');
      return;
    }
    setError(null);

    // If another clock is already running, warn before opening gate
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

    setPin('');
    setPendingPhase(phase);
  }

  function cancelPinGate() {
    setPendingPhase(null);
    setPin('');
    setError(null);
  }

  async function submitPinAndStart(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!pendingPhase || !press) return;
    if (!/^\d{4}$/.test(pin)) {
      setError('PIN must be exactly 4 digits');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/clock/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice,
          decorationId: decIdNum,
          press,
          phase: pendingPhase,
          operatorPin: pin,
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
        phase: pendingPhase,
        startedAt: data.entry.startedAt,
        pausedAt: null,
        pausedDurationSec: 0,
        operatorName: data.operator?.name ?? null,
      };
      localStorage.setItem(ACTIVE_CLOCK_KEY, JSON.stringify(payload));
      router.push('/active');
    } catch (err: any) {
      setError(err?.message ?? 'Network error');
    } finally {
      setBusy(false);
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
              onClick={() => openPinGate(phase)}
              disabled={!press || busy}
              className={
                'h-32 rounded-2xl shadow-lg text-4xl font-extrabold uppercase tracking-wide active:scale-[0.98] transition disabled:opacity-60 ' +
                PHASE_COLORS[phase]
              }
            >
              {phase}
            </button>
          ))}
        </div>

        {error && !pendingPhase && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
            {error}
          </div>
        )}
      </div>

      {pendingPhase && (
        <div className="fixed inset-0 z-50 bg-craft-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <form
            onSubmit={submitPinAndStart}
            className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-5 flex flex-col gap-4"
          >
            <div>
              <div className="text-craft-grey text-xs font-semibold uppercase tracking-wide">
                Operator PIN
              </div>
              <div className="text-2xl font-extrabold">
                Starting {pendingPhase}
              </div>
              <div className="text-craft-grey text-sm mt-1">
                Enter your 4-digit PIN to log this clock entry. Need a PIN?
                See shop admin or {' '}
                <a
                  href="/admin/operators"
                  className="text-craft-cyan font-bold underline"
                >
                  manage operators
                </a>
                .
              </div>
            </div>
            <input
              ref={pinInputRef}
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              autoComplete="off"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                setError(null);
              }}
              placeholder="\u2022\u2022\u2022\u2022"
              className="w-full rounded-xl border-2 border-craft-grey/20 px-4 py-5 text-center text-5xl font-extrabold tracking-[0.5em] font-mono outline-none focus:border-craft-cyan placeholder:text-craft-grey/30"
            />
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
                {error}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={cancelPinGate}
                disabled={busy}
                className="flex-1 h-14 rounded-xl border-2 border-craft-grey/30 font-bold active:scale-[0.99] disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || pin.length !== 4}
                className="flex-[2] h-14 rounded-xl bg-craft-cyan text-white font-extrabold text-lg active:scale-[0.99] disabled:opacity-60"
              >
                {busy ? 'Starting\u2026' : `Start ${pendingPhase}`}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
