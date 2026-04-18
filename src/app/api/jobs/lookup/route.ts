import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { lookupPrintavoInvoice } from '@/lib/printavo';

export const dynamic = 'force-dynamic';

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

  // Cache hit — return existing job (never re-hit Printavo for the same number)
  const existing = await prisma.phaseZeroJob.findUnique({
    where: { printavoInvoiceNumber: invoice },
    include: { decorations: true },
  });
  if (existing) {
    return NextResponse.json({
      cached: true,
      printavoFetched: existing.printavoFetched,
      job: existing,
    });
  }

  // Try Printavo — NEVER throws, always returns an object
  const pv = await lookupPrintavoInvoice(invoice);

  const job = await prisma.phaseZeroJob.create({
    data: {
      printavoInvoiceNumber: invoice,
      jobName: pv.ok ? pv.jobName ?? null : null,
      totalQuantity: pv.ok ? pv.totalQuantity ?? null : null,
      printavoFetched: pv.ok,
    },
    include: { decorations: true },
  });

  return NextResponse.json({
    cached: false,
    printavoFetched: pv.ok,
    printavoError: pv.ok ? undefined : pv.error,
    job,
  });
}
