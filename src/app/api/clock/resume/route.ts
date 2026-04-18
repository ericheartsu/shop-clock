import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * POST /api/clock/resume
 * Body: { entryId: number }
 * Adds (now - pausedAt) to pausedDurationSec, clears pausedAt.
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

  const updated = await prisma.phaseZeroTimeEntry.update({
    where: { id: entryId },
    data: {
      pausedAt: null,
      pausedDurationSec: entry.pausedDurationSec + addSec,
    },
  });
  return NextResponse.json({ entry: updated });
}
