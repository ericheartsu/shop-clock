'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BrandHeader } from '@/components/BrandHeader';
import {
  ACTIVE_CLOCK_KEY,
  formatDuration,
  type ActiveClockPayload,
} from '@/lib/time';
import { PAUSE_REASONS } from '@/lib/config';

export default function ActivePage() {
  const router = useRouter();
  const [active, setActive] = useState<ActiveClockPayload | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [pauseBusy, setPauseBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pause-reason modal state.
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState<string>(PAUSE_REASONS[0]);
  const [pauseReasonOther, setPauseReasonOther] = useState('');

  // Stop modal state — the clock has already stopped by the time this opens.
  // Operator fills session qty + scrap, or skips.
  const [stopModalOpen, setStopModalOpen] = useState(false);
  const [sessionQuantity, setSessionQuantity] = useState('');
  const [scrapCount, setScrapCount] = useState('');
  const [stoppedFrozen, setStoppedFrozen] = useState<number | null>(null);

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
    if (stoppedFrozen !== null) {
      setElapsed(stoppedFrozen);
      return;
    }
    const started = new Date(active.startedAt).getTime();
    const baseAccumulated = active.pausedDurationSec ?? 0;
    const pausedSince = active.pausedAt
      ? new Date(active.pausedAt).getTime()
      : null;

    const update = () => {
      const now = Date.now();
      const gross = (now - started) / 1000;
      const currentPause = pausedSince ? (now - pausedSince) / 1000 : 0;
      const net = gross - baseAccumulated - currentPause;
      setElapsed(Math.max(0, net));
    };
    update();
    tickRef.current = setInterval(update, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [active, stoppedFrozen]);

  function persist(next: ActiveClockPayload) {
    localStorage.setItem(ACTIVE_CLOCK_KEY, JSON.stringify(next));
    setActive(next);
  }

  // PAUSE flow: halt the clock immediately, THEN prompt for a reason. The
  // modal just patches the reason onto the already-paused entry. Skipping
  // the modal leaves reason=null on that pauseLog entry.
  async function beginPause() {
    if (!active || pauseBusy) return;
    setPauseBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/clock/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId: active.entryId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Failed to pause');
        return;
      }
      persist({
        ...active,
        pausedAt: data.entry.pausedAt ?? new Date().toISOString(),
        pausedDurationSec:
          data.entry.pausedDurationSec ?? active.pausedDurationSec ?? 0,
      });
      setPauseReason(PAUSE_REASONS[0]);
      setPauseReasonOther('');
      setPauseModalOpen(true);
    } catch (err: any) {
      setError(err?.message ?? 'Network error');
    } finally {
      setPauseBusy(false);
    }
  }

  async function submitPauseReason(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!active) return;
    if (pauseReason === 'Other' && !pauseReasonOther.trim()) {
      setError('Please type a reason when you pick "Other"');
      return;
    }
    setPauseBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/clock/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryId: active.entryId,
          reason: pauseReason,
          reasonOther: pauseReason === 'Other' ? pauseReasonOther.trim() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Failed to save reason');
        return;
      }
      setPauseModalOpen(false);
    } catch (err: any) {
      setError(err?.message ?? 'Network error');
    } finally {
      setPauseBusy(false);
    }
  }

  async function resume() {
    if (!active || pauseBusy) return;
    setPauseBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/clock/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId: active.entryId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Failed to resume');
        return;
      }
      persist({
        ...active,
        pausedAt: null,
        pausedDurationSec:
          data.entry.pausedDurationSec ?? active.pausedDurationSec ?? 0,
      });
    } catch (err: any) {
      setError(err?.message ?? 'Network error');
    } finally {
      setPauseBusy(false);
    }
  }

  // STOP flow: halt the clock immediately, freeze the timer display, THEN
  // prompt for session qty + scrap. Submitting the modal patches the
  // already-stopped entry. Skipping leaves qty/scrap null — still valid.
  async function beginStop() {
    if (!active || busy) return;
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
      if (typeof data?.entry?.durationSec === 'number') {
        setStoppedFrozen(data.entry.durationSec);
      } else {
        setStoppedFrozen(elapsed);
      }
      setSessionQuantity('');
      setScrapCount('');
      setStopModalOpen(true);
    } catch (err: any) {
      setError(err?.message ?? 'Network error');
    } finally {
      setBusy(false);
    }
  }

  function returnToPhasePicker() {
    if (!active) return;
    localStorage.removeItem(ACTIVE_CLOCK_KEY);
    const { invoice, decorationId, press } = active;
    if (decorationId != null) {
      router.replace(
        `/job/${encodeURIComponent(invoice)}/${decorationId}/phase?press=${encodeURIComponent(press)}`,
      );
    } else {
      router.replace(`/job/${encodeURIComponent(invoice)}`);
    }
  }

  async function undoStop() {
    if (!active || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/clock/undo-stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId: active.entryId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Failed to undo stop');
        return;
      }
      // Sync the active payload to the DB's post-undo state. Stop-while-paused
      // folded the paused span into pausedDurationSec and cleared pausedAt;
      // after undo the entry keeps that folded total and resumes as "running".
      persist({
        ...active,
        pausedAt: null,
        pausedDurationSec:
          data.entry?.pausedDurationSec ?? active.pausedDurationSec ?? 0,
      });
      setStoppedFrozen(null);
      setStopModalOpen(false);
      setSessionQuantity('');
      setScrapCount('');
    } catch (err: any) {
      setError(err?.message ?? 'Network error');
    } finally {
      setBusy(false);
    }
  }

  async function submitStopDetails(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!active) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/clock/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryId: active.entryId,
          sessionQuantity: sessionQuantity === '' ? null : Number(sessionQuantity),
          scrapCount: scrapCount === '' ? null : Number(scrapCount),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Failed to save session output');
        return;
      }
      returnToPhasePicker();
    } catch (err: any) {
      setError(err?.message ?? 'Network error');
    } finally {
      setBusy(false);
    }
  }

  if (!active) return null;

  const isPaused = !!active.pausedAt;

  return (
    <main className="min-h-screen flex flex-col bg-craft-black text-white">
      <BrandHeader crumbs={[`Invoice ${active.invoice}`, active.press, active.phase]} />

      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-6">
        <div className="text-center">
          <div className="text-xs uppercase tracking-widest text-white/60">
            {active.phase}
            {isPaused && (
              <span className="ml-2 inline-block rounded-full bg-craft-orange text-white px-2 py-0.5 text-[10px] font-extrabold">
                PAUSED
              </span>
            )}
          </div>
          <div className="text-lg font-bold text-white/80 mt-1">
            {active.press} {'\u2022'} Invoice {active.invoice}
          </div>
          {active.operatorName && (
            <div className="text-sm font-semibold text-craft-lime mt-1">
              Operator: {active.operatorName}
            </div>
          )}
        </div>

        <div className="text-center">
          <div
            className={
              'font-extrabold tabular-nums leading-none transition-opacity ' +
              (isPaused ? 'opacity-60' : '')
            }
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

        {error && !pauseModalOpen && !stopModalOpen && (
          <div className="rounded-lg bg-red-500/20 border border-red-400 text-red-100 px-3 py-2 text-sm">
            {error}
          </div>
        )}

        <div className="w-full max-w-md flex gap-3">
          <button
            onClick={isPaused ? resume : beginPause}
            disabled={busy || pauseBusy}
            className={
              'h-24 flex-1 rounded-2xl text-2xl font-extrabold shadow-xl active:scale-[0.98] disabled:opacity-60 ' +
              (isPaused
                ? 'bg-craft-lime text-craft-black hover:bg-craft-lime/90'
                : 'bg-craft-orange text-white hover:bg-craft-orange/90')
            }
          >
            {pauseBusy
              ? '\u2026'
              : isPaused
              ? 'RESUME'
              : 'PAUSE'}
          </button>
          <button
            onClick={beginStop}
            disabled={busy || stoppedFrozen !== null}
            className="h-24 flex-[2] rounded-2xl bg-red-600 hover:bg-red-700 text-white text-4xl font-extrabold shadow-2xl active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? 'STOPPING\u2026' : stoppedFrozen !== null ? 'STOPPED' : 'STOP'}
          </button>
        </div>
      </div>

      {pauseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <form
            onSubmit={submitPauseReason}
            className="w-full max-w-md rounded-2xl bg-white text-craft-black shadow-2xl p-5 flex flex-col gap-4"
          >
            <div>
              <div className="text-craft-grey text-xs font-semibold uppercase tracking-wide">
                Clock is paused. Log the reason.
              </div>
              <div className="text-xl font-extrabold">Pick a reason</div>
            </div>
            <select
              autoFocus
              value={pauseReason}
              onChange={(e) => setPauseReason(e.target.value)}
              className="w-full rounded-xl border-2 border-craft-grey/20 px-3 py-4 text-lg bg-white"
            >
              {PAUSE_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            {pauseReason === 'Other' && (
              <label className="block">
                <span className="text-xs font-semibold text-craft-grey">
                  Custom reason
                </span>
                <input
                  value={pauseReasonOther}
                  onChange={(e) => setPauseReasonOther(e.target.value)}
                  placeholder="What's going on?"
                  className="mt-1 w-full rounded-lg border-2 border-craft-grey/20 px-3 py-3 text-lg"
                />
              </label>
            )}
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
                {error}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPauseModalOpen(false)}
                disabled={pauseBusy}
                className="flex-1 h-14 rounded-xl border-2 border-craft-grey/30 font-bold active:scale-[0.99] disabled:opacity-60"
              >
                Skip
              </button>
              <button
                type="submit"
                disabled={pauseBusy}
                className="flex-[2] h-14 rounded-xl bg-craft-orange text-white font-extrabold text-lg active:scale-[0.99] disabled:opacity-60"
              >
                {pauseBusy ? 'Saving\u2026' : 'Save reason'}
              </button>
            </div>
          </form>
        </div>
      )}

      {stopModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <form
            onSubmit={submitStopDetails}
            className="w-full max-w-md rounded-2xl bg-white text-craft-black shadow-2xl p-5 flex flex-col gap-4"
          >
            <div>
              <div className="text-craft-grey text-xs font-semibold uppercase tracking-wide">
                Clock stopped. Log the session output.
              </div>
              <div className="text-xl font-extrabold">Session output</div>
              <div className="text-craft-grey text-sm mt-1">
                Both are optional. Skip to finish without logging counts.
              </div>
              <button
                type="button"
                onClick={undoStop}
                disabled={busy}
                className="mt-2 text-xs font-bold text-craft-cyan hover:underline disabled:opacity-60"
              >
                {'\u2190'} Didn{"\u2019"}t mean to stop {'\u2014'} undo
              </button>
            </div>
            <label className="block">
              <span className="text-xs font-semibold text-craft-grey">
                How many did you print this session?
              </span>
              <input
                autoFocus
                inputMode="numeric"
                pattern="[0-9]*"
                value={sessionQuantity}
                onChange={(e) =>
                  setSessionQuantity(e.target.value.replace(/\D/g, ''))
                }
                placeholder="0"
                className="mt-1 w-full rounded-lg border-2 border-craft-grey/20 px-3 py-4 text-2xl font-bold text-center"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-craft-grey">
                Scrap / misprints (optional)
              </span>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                value={scrapCount}
                onChange={(e) => setScrapCount(e.target.value.replace(/\D/g, ''))}
                placeholder="0"
                className="mt-1 w-full rounded-lg border-2 border-craft-grey/20 px-3 py-4 text-2xl font-bold text-center"
              />
            </label>
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
                {error}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={returnToPhasePicker}
                disabled={busy}
                className="flex-1 h-14 rounded-xl border-2 border-craft-grey/30 font-bold active:scale-[0.99] disabled:opacity-60"
              >
                Skip
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex-[2] h-14 rounded-xl bg-red-600 text-white font-extrabold text-lg active:scale-[0.99] disabled:opacity-60"
              >
                {busy ? 'Saving\u2026' : 'Save output'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
