import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const UNDO_WINDOW_SEC = 300;

/**
 * POST /api/clock/undo-stop
 *
 * Body: { entryId: number }
 *
 * Reopens a freshly-stopped time entry so an operator who hit STOP by
 * accident can keep clocking. Only allowed if the entry stopped within
 * UNDO_WINDOW_SEC ago — older entries are considered truly closed.
 *
 * Clears endedAt, durationSec, sessionQuantity, scrapCount. Leaves
 * pausedDurationSec / pauseLog intact (any paused span we folded on stop
 * stays folded — undo can't reconstruct the pre-stop paused state, and
 * a couple seconds of drift doesn't matter in the immediate-undo case).
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
  if (!entry.endedAt) {
    return NextResponse.json({ error: 'Entry is still running' }, { status: 400 });
  }

  const ageSec = Math.round((Date.now() - entry.endedAt.getTime()) / 1000);
  if (ageSec > UNDO_WINDOW_SEC) {
    return NextResponse.json(
      { error: `Too late to undo — stopped ${ageSec}s ago (limit ${UNDO_WINDOW_SEC}s).` },
      { status: 400 },
    );
  }

  const reopened = await prisma.phaseZeroTimeEntry.update({
    where: { id: entryId },
    data: {
      endedAt: null,
      durationSec: null,
      sessionQuantity: null,
      scrapCount: null,
    },
  });

  return NextResponse.json({ entry: reopened });
}
