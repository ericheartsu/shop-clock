import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  lookupPrintavoInvoice,
  type PrintavoLookupResult,
  type ExtractedDecoration,
} from '@/lib/printavo';

export const dynamic = 'force-dynamic';

/**
 * Upsert a job's decorations from a fresh Printavo pull.
 * Match by case-insensitive `location` so we don't create duplicates
 * if Printavo returns an imprint whose location already exists locally.
 */
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
      // Only fill in method if we don't have one yet — never overwrite
      // user-edited data.
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
        location: dec.location,
        method: dec.method,
      },
    });
  }
}

export async function POST(req: Request) {
  let invoice: string | undefined;
  try {
    const body = await req.json();
    invoice = String(body?.invoice ?? '').trim();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!invoice) {
    return NextResponse.json({ error: 'Missing invoice' }, { status: 400 });
  }

  const existing = await prisma.phaseZeroJob.findUnique({
    where: { printavoInvoiceNumber: invoice },
    include: { decorations: true },
  });

  // Fast path: we already have confirmed Printavo data — don't re-hit the API.
  if (existing && existing.printavoFetched) {
    return NextResponse.json({
      cached: true,
      printavoFetched: true,
      job: existing,
    });
  }

  // Either no row yet, OR a manual-entry row that never successfully pulled
  // Printavo. Either way, try Printavo.
  const pv: PrintavoLookupResult = await lookupPrintavoInvoice(invoice);

  if (existing) {
    // Row exists but printavoFetched was false. Auto-heal if Printavo now works.
    if (pv.ok) {
      const updated = await prisma.phaseZeroJob.update({
        where: { id: existing.id },
        data: {
          jobName: pv.jobName ?? existing.jobName,
          totalQuantity: pv.totalQuantity ?? existing.totalQuantity,
          printavoFetched: true,
        },
      });
      await upsertDecorations(existing.id, pv.decorations ?? []);
      const refreshed = await prisma.phaseZeroJob.findUnique({
        where: { id: updated.id },
        include: { decorations: true },
      });
      return NextResponse.json({
        cached: false,
        healed: true,
        printavoFetched: true,
        job: refreshed,
      });
    }
    // Printavo still failing — return the stale row unchanged, no error.
    return NextResponse.json({
      cached: true,
      printavoFetched: false,
      printavoError: pv.error,
      job: existing,
    });
  }

  // Brand new row.
  const job = await prisma.phaseZeroJob.create({
    data: {
      printavoInvoiceNumber: invoice,
      jobName: pv.ok ? pv.jobName ?? null : null,
      totalQuantity: pv.ok ? pv.totalQuantity ?? null : null,
      printavoFetched: pv.ok,
    },
  });
  if (pv.ok) {
    await upsertDecorations(job.id, pv.decorations ?? []);
  }
  const full = await prisma.phaseZeroJob.findUnique({
    where: { id: job.id },
    include: { decorations: true },
  });

  return NextResponse.json({
    cached: false,
    printavoFetched: pv.ok,
    printavoError: pv.ok ? undefined : pv.error,
    job: full,
  });
}
