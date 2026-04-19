export function formatDuration(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

export const ACTIVE_CLOCK_KEY = 'shop-clock:active';

export interface ActiveClockPayload {
  entryId: number;
  invoice: string;
  decorationId: number | null;
  decorationLabel: string;
  press: string;
  phase: string;
  startedAt: string; // ISO
  /** ISO timestamp when the current pause began, or null if running */
  pausedAt?: string | null;
  /** Cumulative paused seconds from all *completed* pause spans */
  pausedDurationSec?: number;
  /** Resolved operator name from the PIN gate (display only — DB has the snapshot). */
  operatorName?: string | null;
}
