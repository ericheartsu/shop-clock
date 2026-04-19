import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/operators
 * Query: ?active=1 (default returns all; active=1 returns only active rows)
 *
 * Lists operators for the admin page and for the PIN gate dropdown (future).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const activeOnly = url.searchParams.get('active') === '1';
  const operators = await prisma.operator.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
  });
  return NextResponse.json({ operators });
}

function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

/**
 * POST /api/operators
 * Body: { name: string, pin: string (4 digits), active?: boolean }
 *
 * Creates a new operator. PIN must be exactly 4 digits and unique.
 */
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name = String(body?.name ?? '').trim();
  const pin = String(body?.pin ?? '').trim();
  const active = body?.active === undefined ? true : Boolean(body.active);

  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  if (!isValidPin(pin)) {
    return NextResponse.json(
      { error: 'PIN must be exactly 4 digits' },
      { status: 400 },
    );
  }

  const existing = await prisma.operator.findUnique({ where: { pin } });
  if (existing) {
    return NextResponse.json(
      { error: `PIN ${pin} is already in use by ${existing.name}` },
      { status: 409 },
    );
  }

  const operator = await prisma.operator.create({
    data: { name, pin, active },
  });
  return NextResponse.json({ operator });
}
