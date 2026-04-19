import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  isValidPhase,
  isValidPress,
  isValidMethod,
  isValidLocation,
} from '@/lib/config';

export const dynamic = 'force-dynamic';

/**
 * POST /api/clock/start
 *
 * Body: {
 *   invoice: string,
 *   press: Press,
 *   phase: Phase,
 *   decorationId?: number | null,
 *   operatorPin: string (4 digits, REQUIRED as of capture-hardening 2026-04-19),
 * }
 *
 * Captures operator identity at clock-in via a PIN lookup, then freezes
 * name + PIN on the time entry so future edits to the Operator row don't
 * retroactively rewrite history.
 *
 * Also snapshots the Printavo payload onto the job (printavoSnapshot) the
 * first time a clock-in happens — immutable after that even if the job is
 * re-pulled. If the job has no snapshot yet and we have Printavo data in
 * memory on the job row, we capture that; otherwise leaves snapshot null.
 */
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
  const operatorPin = String(body?.operatorPin ?? '').trim();
  const decorationId =
    body?.decorationId === null || body?.decorationId === undefined
      ? null
      : Number(body.decorationId);

  if (!invoice) return NextResponse.json({ error: 'Missing invoice' }, { status: 400 });
  if (!isValidPress(press)) return NextResponse.json({ error: 'Invalid press' }, { status: 400 });
  if (!isValidPhase(phase)) return NextResponse.json({ error: 'Invalid phase' }, { status: 400 });
  if (!/^\d{4}$/.test(operatorPin)) {
    return NextResponse.json(
      { error: 'Operator PIN is required (4 digits)' },
      { status: 400 },
    );
  }

  const operator = await prisma.operator.findUnique({ where: { pin: operatorPin } });
  if (!operator || !operator.active) {
    return NextResponse.json(
      { error: 'No active operator matches that PIN' },
      { status: 404 },
    );
  }

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
    // Validate controlled vocabulary on the decoration before starting a
    // clock — stops bad rows from being locked in. "Other" is allowed in
    // location (with freeform locationOther).
    if (!isValidLocation(dec.location)) {
      return NextResponse.json(
        {
          error: `Decoration location "${dec.location}" is not in the picklist — edit it before clocking.`,
        },
        { status: 400 },
      );
    }
    if (dec.method && !isValidMethod(dec.method)) {
      return NextResponse.json(
        {
          error: `Decoration method "${dec.method}" is not in the picklist — edit it before clocking.`,
        },
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
      operatorId: operator.id,
      operatorNameSnapshot: operator.name,
      operatorPinSnapshot: operator.pin,
    },
  });

  return NextResponse.json({
    entry,
    operator: { id: operator.id, name: operator.name },
  });
}
