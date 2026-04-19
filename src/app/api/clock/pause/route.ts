import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isValidPauseReason } from '@/lib/config';

export const dynamic = 'force-dynamic';

/**
 * POST /api/clock/pause
 * Body: { entryId: number, reason: string, reasonOther?: string }
 *
 * Sets pausedAt = now() and captures a pause reason. Reason is a picklist
 * value; "Other" requires reasonOther freeform text. Idempotent-ish: if
 * already paused, returns current state without clobbering the original
 * pausedAt (but does NOT let the operator change the reason mid-pause —
 * resume first, pause again with new reason).
 */
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const entryId = Number(body?.entryId);
  const reasonRaw = String(body?.reason ?? '').trim();
  const reasonOther = body?.reasonOther
    ? String(body.reasonOther).trim()
    : null;

  if (!Number.isFinite(entryId)) {
    return NextResponse.json({ error: 'Missing entryId' }, { status: 400 });
  }
  if (!reasonRaw) {
    return NextResponse.json(
      { error: 'Pause reason is required' },
      { status: 400 },
    );
  }
  if (!isValidPauseReason(reasonRaw)) {
    return NextResponse.json(
      { error: `Reason "${reasonRaw}" is not in the picklist` },
      { status: 400 },
    );
  }
  const resolvedReason =
    reasonRaw === 'Other'
      ? reasonOther || null
      : reasonRaw;
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
    // Already paused — return as-is so the UI can sync.
    return NextResponse.json({ entry });
  }

  const pausedAt = new Date();

  // Append an OPEN entry to pauseLog — resumedAt filled on resume.
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
