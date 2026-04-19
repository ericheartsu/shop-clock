import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * POST /api/clock/resume
 * Body: { entryId: number }
 * Adds (now - pausedAt) to pausedDurationSec, clears pausedAt, and closes
 * the open entry in pauseLog by filling resumedAt.
 *
 * pauseReason column is preserved as the MOST RECENT reason — the pauseLog
 * is the full history.
 */
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const entryId = Number(body?.entryId);
  if (!Number.isFinite(entryId)) {
    return NextResponse.json({ error: 'Missing entryId' }, { status: 400 });
  }

  const entry = await prisma.phaseZeroTimeEntry.findUnique({ where: { id: entryId } });
  if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  if (entry.endedAt) {
    return NextResponse.json({ error: 'Entry already stopped' }, { status: 400 });
  }
  if (!entry.pausedAt) {
    // Not paused — nothing to resume. Return existing state.
    return NextResponse.json({ entry });
  }

  const now = new Date();
  const addSec = Math.max(
    0,
    Math.round((now.getTime() - entry.pausedAt.getTime()) / 1000),
  );

  // Close the open pauseLog entry (last one with resumedAt == null).
  const prevLog: any[] = Array.isArray(entry.pauseLog) ? (entry.pauseLog as any[]) : [];
  const newLog = [...prevLog];
  for (let i = newLog.length - 1; i >= 0; i--) {
    if (newLog[i] && !newLog[i].resumedAt) {
      newLog[i] = { ...newLog[i], resumedAt: now.toISOString() };
      break;
    }
  }

  const updated = await prisma.phaseZeroTimeEntry.update({
    where: { id: entryId },
    data: {
      pausedAt: null,
      pausedDurationSec: entry.pausedDurationSec + addSec,
      pauseLog: newLog,
    },
  });
  return NextResponse.json({ entry: updated });
}
