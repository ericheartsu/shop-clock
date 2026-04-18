import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * POST /api/clock/pause
 * Body: { entryId: number }
 * Sets `pausedAt = now()` on the entry. Idempotent-ish: if already paused,
 * returns the existing state without clobbering the original pausedAt.
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
  if (entry.pausedAt) {
    // Already paused — return as-is so the UI can sync.
    return NextResponse.json({ entry });
  }

  const updated = await prisma.phaseZeroTimeEntry.update({
    where: { id: entryId },
    data: { pausedAt: new Date() },
  });
  return NextResponse.json({ entry: updated });
}
