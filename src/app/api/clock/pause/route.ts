import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isValidPauseReason } from '@/lib/config';

export const dynamic = 'force-dynamic';

/**
 * POST /api/clock/pause
 * Body: { entryId: number, reason?: string, reasonOther?: string }
 *
 * Halts the clock immediately. Reason is optional — operators can pause
 * right away and fill the reason in the follow-up modal. Re-calling this
 * on an already-paused entry with a reason updates the latest open
 * pauseLog entry, so the async UI can submit the reason after the pause
 * landed.
 */
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const entryId = Number(body?.entryId);
  const reasonRaw = body?.reason ? String(body.reason).trim() : '';
  const reasonOther = body?.reasonOther
    ? String(body.reasonOther).trim()
    : null;

  if (!Number.isFinite(entryId)) {
    return NextResponse.json({ error: 'Missing entryId' }, { status: 400 });
  }
  if (reasonRaw && !isValidPauseReason(reasonRaw)) {
    return NextResponse.json(
      { error: `Reason "${reasonRaw}" is not in the picklist` },
      { status: 400 },
    );
  }
  const resolvedReason = reasonRaw
    ? reasonRaw === 'Other'
      ? reasonOther || null
      : reasonRaw
    : null;
  if (reasonRaw === 'Other' && !resolvedReason) {
    return NextResponse.json(
      { error: 'When reason is "Other", a custom reason is required' },
      { status: 400 },
    );
  }

  const entry = await prisma.phaseZeroTimeEntry.findUnique({ where: { id: entryId } });
  if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  if (entry.endedAt) {
    return NextResponse.json({ error: 'Entry already stopped' }, { status: 400 });
  }

  if (entry.pausedAt) {
    // Already paused — fill in the reason on the latest open pauseLog entry
    // if one was supplied. No-op if no reason provided.
    if (!resolvedReason) return NextResponse.json({ entry });
    const prevLog: any[] = Array.isArray(entry.pauseLog) ? (entry.pauseLog as any[]) : [];
    const newLog = [...prevLog];
    for (let i = newLog.length - 1; i >= 0; i--) {
      if (newLog[i] && !newLog[i].resumedAt) {
        newLog[i] = { ...newLog[i], reason: resolvedReason };
        break;
      }
    }
    const updated = await prisma.phaseZeroTimeEntry.update({
      where: { id: entryId },
      data: { pauseReason: resolvedReason, pauseLog: newLog },
    });
    return NextResponse.json({ entry: updated });
  }

  const pausedAt = new Date();
  const prevLog: any[] = Array.isArray(entry.pauseLog) ? (entry.pauseLog as any[]) : [];
  const newLog = [
    ...prevLog,
    { pausedAt: pausedAt.toISOString(), resumedAt: null, reason: resolvedReason },
  ];

  const updated = await prisma.phaseZeroTimeEntry.update({
    where: { id: entryId },
    data: {
      pausedAt,
      pauseReason: resolvedReason,
      pauseLog: newLog,
    },
  });
  return NextResponse.json({ entry: updated });
}
