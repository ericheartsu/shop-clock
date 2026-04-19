import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * POST /api/operators/resolve
 * Body: { pin: string }
 * Returns { operator } on match (active rows only), 404 on miss.
 *
 * Used by the clock-in PIN gate. Invalid PIN = explicit 404 with a clear
 * error — no silent fallback, no auto-create. Mismatches must surface.
 */
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const pin = String(body?.pin ?? '').trim();
  if (!/^\d{4}$/.test(pin)) {
    return NextResponse.json(
      { error: 'PIN must be 4 digits' },
      { status: 400 },
    );
  }

  const operator = await prisma.operator.findUnique({ where: { pin } });
  if (!operator || !operator.active) {
    return NextResponse.json(
      { error: 'No active operator matches that PIN' },
      { status: 404 },
    );
  }

  return NextResponse.json({ operator });
}
