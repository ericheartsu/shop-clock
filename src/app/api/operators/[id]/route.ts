import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

/**
 * PATCH /api/operators/[id]
 * Body: { name?, pin?, active? }
 * Updates a single operator. PIN must be unique when changed.
 *
 * Note: editing an operator does NOT rewrite past time entries. Each entry
 * freezes operatorNameSnapshot + operatorPinSnapshot at clock-in, so history
 * stays stable even if a PIN is rotated or a name is corrected here.
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const operatorId = Number(id);
  if (!Number.isFinite(operatorId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const existing = await prisma.operator.findUnique({ where: { id: operatorId } });
  if (!existing) {
    return NextResponse.json({ error: 'Operator not found' }, { status: 404 });
  }

  const data: { name?: string; pin?: string; active?: boolean } = {};

  if (body?.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
    data.name = name;
  }

  if (body?.pin !== undefined) {
    const pin = String(body.pin).trim();
    if (!isValidPin(pin)) {
      return NextResponse.json(
        { error: 'PIN must be exactly 4 digits' },
        { status: 400 },
      );
    }
    if (pin !== existing.pin) {
      const clash = await prisma.operator.findUnique({ where: { pin } });
      if (clash && clash.id !== operatorId) {
        return NextResponse.json(
          { error: `PIN ${pin} is already in use by ${clash.name}` },
          { status: 409 },
        );
      }
    }
    data.pin = pin;
  }

  if (body?.active !== undefined) {
    data.active = Boolean(body.active);
  }

  const operator = await prisma.operator.update({
    where: { id: operatorId },
    data,
  });
  return NextResponse.json({ operator });
}
