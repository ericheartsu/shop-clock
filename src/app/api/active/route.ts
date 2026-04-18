import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Debug endpoint — lists all currently open (unstopped) time entries.
 * Handy for spotting clocks that someone forgot to stop.
 */
export async function GET() {
  const entries = await prisma.phaseZeroTimeEntry.findMany({
    where: { endedAt: null },
    orderBy: { startedAt: 'desc' },
    include: {
      job: { select: { printavoInvoiceNumber: true, jobName: true } },
      decoration: { select: { location: true, method: true } },
    },
  });
  return NextResponse.json({ count: entries.length, entries });
}
