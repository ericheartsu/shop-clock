import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isValidLocation, isValidMethod } from '@/lib/config';

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

  const data: {
    location?: string;
    locationOther?: string | null;
    method?: string | null;
    colorCount?: number | null;
  } = {};

  if (body?.location !== undefined) {
    const location = String(body.location).trim();
    if (!location) {
      return NextResponse.json({ error: 'Location is required' }, { status: 400 });
    }
    if (!isValidLocation(location)) {
      return NextResponse.json(
        { error: `Location "${location}" is not in the picklist` },
        { status: 400 },
      );
    }
    data.location = location;
    // Clear locationOther if the new location isn't Other, unless body is
    // simultaneously setting a new locationOther.
    if (location !== 'Other' && body?.locationOther === undefined) {
      data.locationOther = null;
    }
  }

  if (body?.locationOther !== undefined) {
    const raw = body.locationOther;
    const value = raw === null || raw === '' ? null : String(raw).trim() || null;
    data.locationOther = value;
  }

  // If the final state would be location=Other with no locationOther, reject.
  const finalLocation = data.location ?? existing.location;
  const finalLocationOther =
    data.locationOther !== undefined ? data.locationOther : existing.locationOther;
  if (finalLocation === 'Other' && !finalLocationOther) {
    return NextResponse.json(
      { error: 'When location is "Other", a custom label is required' },
      { status: 400 },
    );
  }

  if (body?.method !== undefined) {
    const raw = body.method;
    if (raw === null || raw === '') {
      data.method = null;
    } else {
      const method = String(raw).trim();
      if (!isValidMethod(method)) {
        return NextResponse.json(
          { error: `Method "${method}" is not in the picklist` },
          { status: 400 },
        );
      }
      data.method = method;
    }
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
