import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ invoice: string }> },
) {
  const { invoice } = await ctx.params;
  const job = await prisma.phaseZeroJob.findUnique({
    where: { printavoInvoiceNumber: invoice },
    include: {
      decorations: { orderBy: { id: 'asc' } },
    },
  });
  if (!job) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ job });
}

/**
 * PATCH /api/jobs/[invoice]
 * Body: { customerName?: string | null, hqOrderHint?: string | null }
 *
 * Lets the operator override the auto-filled customer name and attach an
 * HQ order hint for future reconciliation. Does NOT touch printavoSnapshot
 * (that's immutable after first fetch) or decorations (use the dedicated
 * decorations endpoints).
 */
export async function PATCH(
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

  const job = await prisma.phaseZeroJob.findUnique({
    where: { printavoInvoiceNumber: invoice },
  });
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const data: { customerName?: string | null; hqOrderHint?: string | null } = {};

  if (body?.customerName !== undefined) {
    const raw = body.customerName;
    if (raw === null || raw === '') {
      data.customerName = null;
    } else {
      const trimmed = String(raw).trim();
      data.customerName = trimmed.length ? trimmed.slice(0, 200) : null;
    }
  }

  if (body?.hqOrderHint !== undefined) {
    const raw = body.hqOrderHint;
    if (raw === null || raw === '') {
      data.hqOrderHint = null;
    } else {
      const trimmed = String(raw).trim();
      data.hqOrderHint = trimmed.length ? trimmed.slice(0, 100) : null;
    }
  }

  const updated = await prisma.phaseZeroJob.update({
    where: { id: job.id },
    data,
    include: { decorations: { orderBy: { id: 'asc' } } },
  });
  return NextResponse.json({ job: updated });
}
