import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  lookupPrintavoInvoice,
  type ExtractedDecoration,
} from '@/lib/printavo';

export const dynamic = 'force-dynamic';

async function upsertDecorations(
  jobId: number,
  decorations: ExtractedDecoration[],
) {
  if (!decorations.length) return;
  const existing = await prisma.phaseZeroDecoration.findMany({
    where: { jobId },
    select: { id: true, location: true, method: true },
  });
  const byKey = new Map(
    existing.map((d) => [d.location.trim().toLowerCase(), d]),
  );
  for (const dec of decorations) {
    const key = dec.location.trim().toLowerCase();
    const match = byKey.get(key);
    if (match) {
      if (!match.method && dec.method) {
        await prisma.phaseZeroDecoration.update({
          where: { id: match.id },
          data: { method: dec.method },
        });
      }
      continue;
    }
    await prisma.phaseZeroDecoration.create({
      data: { jobId, location: dec.location, method: dec.method },
    });
  }
}

/**
 * POST /api/jobs/[invoice]/repull
 * Force a fresh Printavo pull for an already-known invoice. Updates job
 * fields and upserts decorations. User-triggered (e.g. someone added
 * imprints in Printavo after our cache was built).
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ invoice: string }> },
) {
  const { invoice } = await ctx.params;
  const job = await prisma.phaseZeroJob.findUnique({
    where: { printavoInvoiceNumber: invoice },
  });
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const pv = await lookupPrintavoInvoice(invoice);
  if (!pv.ok) {
    return NextResponse.json(
      { error: pv.error ?? 'Printavo lookup failed', ok: false },
      { status: 502 },
    );
  }

  await prisma.phaseZeroJob.update({
    where: { id: job.id },
    data: {
      jobName: pv.jobName ?? job.jobName,
      totalQuantity: pv.totalQuantity ?? job.totalQuantity,
      printavoFetched: true,
    },
  });
  await upsertDecorations(job.id, pv.decorations ?? []);

  const refreshed = await prisma.phaseZeroJob.findUnique({
    where: { id: job.id },
    include: { decorations: { orderBy: { id: 'asc' } } },
  });
  return NextResponse.json({ ok: true, job: refreshed });
}
