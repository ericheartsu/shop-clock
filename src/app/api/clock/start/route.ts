import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isValidPhase, isValidPress } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const invoice = String(body?.invoice ?? '').trim();
  const press = String(body?.press ?? '').trim();
  const phase = String(body?.phase ?? '').trim();
  const decorationId =
    body?.decorationId === null || body?.decorationId === undefined
      ? null
      : Number(body.decorationId);

  if (!invoice) return NextResponse.json({ error: 'Missing invoice' }, { status: 400 });
  if (!isValidPress(press)) return NextResponse.json({ error: 'Invalid press' }, { status: 400 });
  if (!isValidPhase(phase)) return NextResponse.json({ error: 'Invalid phase' }, { status: 400 });

  const job = await prisma.phaseZeroJob.findUnique({
    where: { printavoInvoiceNumber: invoice },
  });
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  if (decorationId !== null) {
    const dec = await prisma.phaseZeroDecoration.findUnique({
      where: { id: decorationId },
    });
    if (!dec || dec.jobId !== job.id) {
      return NextResponse.json(
        { error: 'Decoration not found for this job' },
        { status: 400 },
      );
    }
  }

  const entry = await prisma.phaseZeroTimeEntry.create({
    data: {
      jobId: job.id,
      decorationId,
      press,
      phase,
      startedAt: new Date(),
    },
  });

  return NextResponse.json({ entry });
}
