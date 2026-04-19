// Shop Clock — Operator seed.
// One-click: `node prisma/seed-operators.mjs` (requires DATABASE_URL in env).
//
// Idempotent: upserts by PIN, never deletes existing rows. Safe to re-run.
// Does NOT rotate PINs if they already exist — rotate from /admin/operators.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SEEDS = [
  { name: 'Eric',      pin: '1111', active: true },
  { name: 'Press Op',  pin: '2222', active: true },
  { name: 'Shop Test', pin: '3333', active: true },
];

async function main() {
  let created = 0;
  let skipped = 0;
  for (const row of SEEDS) {
    const existing = await prisma.operator.findUnique({ where: { pin: row.pin } });
    if (existing) {
      console.log(`[seed] skipping ${row.name} (PIN ${row.pin} already belongs to ${existing.name})`);
      skipped++;
      continue;
    }
    await prisma.operator.create({ data: row });
    console.log(`[seed] created ${row.name} / PIN ${row.pin}`);
    created++;
  }
  console.log(`[seed] done. created=${created} skipped=${skipped}`);
}

main()
  .catch((err) => {
    console.error('[seed] FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
