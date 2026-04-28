import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const HQ_API_URL = process.env.HQ_API_URL;
const HQ_INGEST_SECRET = process.env.HQ_INGEST_SECRET;
const HQ_TENANT_ID = process.env.HQ_TENANT_ID;

/**
 * POST /api/operators/sync
 *
 * Admin-only. Pulls active operators from HQ and upserts them into the local
 * Operator table. HQ is the source of truth for names, PINs, and hqUserId.
 *
 * After sync, PIN verification uses bcrypt compare against the locally cached
 * hash — so the clock-in flow works even if HQ is temporarily unreachable.
 */
export async function POST() {
  if (!HQ_API_URL || !HQ_INGEST_SECRET || !HQ_TENANT_ID) {
    return NextResponse.json(
      { error: 'HQ_API_URL, HQ_INGEST_SECRET, and HQ_TENANT_ID must be set in env' },
      { status: 500 },
    );
  }

  const res = await fetch(
    `${HQ_API_URL}/api/ingest/shop-clock?tenantId=${HQ_TENANT_ID}`,
    { headers: { 'x-shop-clock-secret': HQ_INGEST_SECRET } },
  );

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `HQ sync failed: ${text}` }, { status: 502 });
  }

  const operators: Array<{ id: number; name: string; pinHash: string }> = await res.json();

  let created = 0;
  let updated = 0;

  for (const op of operators) {
    const existing = await prisma.operator.findUnique({ where: { hqUserId: op.id } });
    if (existing) {
      await prisma.operator.update({
        where: { id: existing.id },
        data: { name: op.name, pin: op.pinHash, active: true },
      });
      updated++;
    } else {
      // Check if there's a name-matched local record without hqUserId (legacy)
      const byName = await prisma.operator.findFirst({ where: { name: op.name, hqUserId: null } });
      if (byName) {
        await prisma.operator.update({
          where: { id: byName.id },
          data: { pin: op.pinHash, hqUserId: op.id, active: true },
        });
        updated++;
      } else {
        await prisma.operator.create({
          data: { name: op.name, pin: op.pinHash, hqUserId: op.id, active: true },
        });
        created++;
      }
    }
  }

  // Deactivate any local operators whose hqUserId is no longer in the HQ list
  const activeHqIds = operators.map(o => o.id);
  if (activeHqIds.length > 0) {
    await prisma.operator.updateMany({
      where: { hqUserId: { not: null, notIn: activeHqIds } },
      data: { active: false },
    });
  }

  return NextResponse.json({ ok: true, created, updated, total: operators.length });
}
