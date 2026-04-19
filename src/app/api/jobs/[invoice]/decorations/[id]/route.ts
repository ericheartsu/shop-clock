import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ invoice: string; id: string }> },
) {
  const { invoice, id } = await ctx.params;
  const decorationId = Number(id);
  if (!Number.isFinite(decorationId)) {
    return NextResponse.json({ error: 'Invalid decoration id' }, { status: 400 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const job = await prisma.phaseZeroJob.findUnique({
    where: { printavoInvoiceNumber: invoice },
  });
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const existing = await prisma.phaseZeroDecoration.findUnique({
    where: { id: decorationId },
  });
  if (!existing || existing.jobId !== job.id) {
    return NextResponse.json({ error: 'Decoration not found' }, { status: 404 });
  }

  const data: { location?: string; method?: string | null; colorCount?: number | null } = {};

  if (body?.location !== undefined) {
    const location = String(body.location).trim();
    if (!location) {
      return NextResponse.json({ error: 'Location is required' }, { status: 400 });
    }
    data.location = location;
  }

  if (body?.method !== undefined) {
    const raw = body.method;
    data.method = raw === null || raw === '' ? null : String(raw).trim();
  }

  if (body?.colorCount !== undefined) {
    const raw = body.colorCount;
    if (raw === null || raw === '') {
      data.colorCount = null;
    } else {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json({ error: 'Invalid colorCount' }, { status: 400 });
      }
      data.colorCount = n;
    }
  }

  const decoration = await prisma.phaseZeroDecoration.update({
    where: { id: decorationId },
    data,
  });

  return NextResponse.json({ decoration });
}
