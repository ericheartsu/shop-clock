import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const entryId = Number(body?.entryId);
  const notes = body?.notes ? String(body.notes).slice(0, 2000) : null;

  if (!Number.isFinite(entryId)) {
    return NextResponse.json({ error: 'Missing entryId' }, { status: 400 });
  }

  const entry = await prisma.phaseZeroTimeEntry.findUnique({ where: { id: entryId } });
  if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  if (entry.endedAt) {
    return NextResponse.json({ error: 'Entry already stopped', entry });
  }

  const endedAt = new Date();
  const durationSec = Math.max(
    0,
    Math.round((endedAt.getTime() - entry.startedAt.getTime()) / 1000),
  );

  const updated = await prisma.phaseZeroTimeEntry.update({
    where: { id: entryId },
    data: { endedAt, durationSec, notes },
  });

  return NextResponse.json({ entry: updated });
}
