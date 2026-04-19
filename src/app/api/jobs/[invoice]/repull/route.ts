import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  lookupPrintavoInvoice,
  type ExtractedDecoration,
  type PrintavoLookupResult,
} from '@/lib/printavo';

export const dynamic = 'force-dynamic';

function extractCustomerName(pv: PrintavoLookupResult): string | null {
  const order: any = pv.order ?? {};
  return (
    order?.customer?.companyName ??
    order?.customer?.name ??
    order?.contact?.fullName ??
    null
  );
}

async function upsertDecorations(
  jobId: number,
  decorations: ExtractedDecoration[],
) {
  if (!decorations.length) return;
  const existing = await prisma.phaseZeroDecoration.findMany({
    where: { jobId },
    select: { id: true, location: true, locationOther: true, method: true },
  });
  // Match against the visible label (location or, if Other, locationOther).
  const byKey = new Map(
    existing.map((d) => {
      const label =
        d.location === 'Other' ? (d.locationOther ?? '').trim() : d.location;
      return [label.toLowerCase(), d];
    }),
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
      data: {
        jobId,
        location: 'Other',
        locationOther: dec.location,
        method: dec.method,
      },
    });
  }
}

/**
 * POST /api/jobs/[invoice]/repull
 * Force a fresh Printavo pull for an already-known invoice. Updates job
 * fields and upserts decorations. User-triggered (e.g. someone added
 * imprints in Printavo after our cache was built).
 *
 * printavoSnapshot is only written if the job has none yet — this
 * preserves the original snapshot for any rows that were clocked in
 * against earlier data, so reconciliation stays stable.
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
      customerName: job.customerName ?? extractCustomerName(pv),
      printavoSnapshot: job.printavoSnapshot ?? ((pv.order as any) ?? undefined),
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
