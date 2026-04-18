import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  ctx: { params: Promise<{ invoice: string }> },
) {
  const { invoice } = await ctx.params;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const location = String(body?.location ?? '').trim();
  const method = body?.method ? String(body.method).trim() : null;
  const colorCountRaw = body?.colorCount;
  const colorCount =
    colorCountRaw === null || colorCountRaw === undefined || colorCountRaw === ''
      ? null
      : Number(colorCountRaw);

  if (!location) {
    return NextResponse.json({ error: 'Location is required' }, { status: 400 });
  }
  if (colorCount !== null && (!Number.isFinite(colorCount) || colorCount < 0)) {
    return NextResponse.json({ error: 'Invalid colorCount' }, { status: 400 });
  }

  const job = await prisma.phaseZeroJob.findUnique({
    where: { printavoInvoiceNumber: invoice },
  });
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const decoration = await prisma.phaseZeroDecoration.create({
    data: {
      jobId: job.id,
      location,
      method,
      colorCount,
    },
  });

  return NextResponse.json({ decoration });
}
