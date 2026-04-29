import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { compare } from 'bcryptjs';

export const dynamic = 'force-dynamic';

/**
 * POST /api/operators/resolve
 * Body: { pin: string }
 * Returns { operator } on match (active rows only), 404 on miss.
 *
 * PINs are stored as bcrypt hashes — compare against all active operators.
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

  const activeOperators = await prisma.operator.findMany({ where: { active: true } });
  let operator: typeof activeOperators[0] | null = null;
  for (const op of activeOperators) {
    if (await compare(pin, op.pin)) { operator = op; break; }
  }

  if (!operator) {
    return NextResponse.json(
      { error: 'No active operator matches that PIN' },
      { status: 404 },
    );
  }

  return NextResponse.json({ operator });
}
