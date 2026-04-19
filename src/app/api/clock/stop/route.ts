import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * POST /api/clock/stop
 *
 * Body: {
 *   entryId: number,
 *   notes?: string | null,
 *   sessionQuantity?: number | null, // optional — "how many did you print?"
 *   scrapCount?: number | null,      // optional — "any scrap/misprints?"
 * }
 *
 * Stops the clock, folds any active pause into pausedDurationSec, closes the
 * open pauseLog entry if needed, and records session output counts.
 */
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const entryId = Number(body?.entryId);
  const notes = body?.notes ? String(body.notes).slice(0, 2000) : null;

  function parseOptionalCount(raw: unknown, field: string): number | null | { error: string } {
    if (raw === null || raw === undefined || raw === '') return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      return { error: `${field} must be a non-negative integer` };
    }
    return n;
  }

  const qtyResult = parseOptionalCount(body?.sessionQuantity, 'sessionQuantity');
  if (qtyResult && typeof qtyResult === 'object' && 'error' in qtyResult) {
    return NextResponse.json({ error: qtyResult.error }, { status: 400 });
  }
  const scrapResult = parseOptionalCount(body?.scrapCount, 'scrapCount');
  if (scrapResult && typeof scrapResult === 'object' && 'error' in scrapResult) {
    return NextResponse.json({ error: scrapResult.error }, { status: 400 });
  }
  const sessionQuantity = qtyResult as number | null;
  const scrapCount = scrapResult as number | null;

  if (!Number.isFinite(entryId)) {
    return NextResponse.json({ error: 'Missing entryId' }, { status: 400 });
  }

  const entry = await prisma.phaseZeroTimeEntry.findUnique({ where: { id: entryId } });
  if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  if (entry.endedAt) {
    return NextResponse.json({ error: 'Entry already stopped', entry });
  }

  const endedAt = new Date();

  // If we're stopping while paused, fold the current paused span into the
  // cumulative paused duration so the final durationSec is accurate.
  let pausedDurationSec = entry.pausedDurationSec;
  let pauseLog: any[] = Array.isArray(entry.pauseLog) ? (entry.pauseLog as any[]) : [];
  if (entry.pausedAt) {
    const addSec = Math.max(
      0,
      Math.round((endedAt.getTime() - entry.pausedAt.getTime()) / 1000),
    );
    pausedDurationSec += addSec;
    // Close the open pauseLog entry with resumedAt = endedAt so the log is
    // consistent (even though we never technically "resumed").
    for (let i = pauseLog.length - 1; i >= 0; i--) {
      if (pauseLog[i] && !pauseLog[i].resumedAt) {
        pauseLog[i] = { ...pauseLog[i], resumedAt: endedAt.toISOString() };
        break;
      }
    }
  }

  const grossSec = Math.max(
    0,
    Math.round((endedAt.getTime() - entry.startedAt.getTime()) / 1000),
  );
  const durationSec = Math.max(0, grossSec - pausedDurationSec);

  const updated = await prisma.phaseZeroTimeEntry.update({
    where: { id: entryId },
    data: {
      endedAt,
      durationSec,
      pausedDurationSec,
      pausedAt: null,
      pauseLog,
      notes,
      sessionQuantity,
      scrapCount,
    },
  });

  return NextResponse.json({ entry: updated });
}
