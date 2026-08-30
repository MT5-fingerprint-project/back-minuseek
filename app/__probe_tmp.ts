import { PrismaClient } from './generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
(async () => {
  const pool = new Pool({ connectionString: 'postgresql://minuseek:password@localhost:5433/l41a_review', max: 5 });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const caseId = '99999999-0000-0000-0000-000000000001';
  await prisma.investigationCase.create({ data: { id: caseId, caseNumber: 'PROBE'+Date.now(), pvNumber: 'PV', updatedAt: new Date() } }).catch(()=>{});
  await prisma.$transaction(async (tx) => {
    await tx.trace.create({ data: { id: '88888888-0000-0000-0000-000000000001', number: 1, path: 'p1', caseId, updatedAt: new Date() } });
    await tx.$executeRawUnsafe('SELECT pg_sleep(1.5)');
    await tx.trace.create({ data: { id: '88888888-0000-0000-0000-000000000002', number: 2, path: 'p2', caseId, updatedAt: new Date() } });
  });
  const rows = await prisma.trace.findMany({ where: { caseId }, orderBy: { number: 'asc' } });
  console.log(rows.map(r => ({ n: r.number, createdAt: r.createdAt.toISOString() })));
  await prisma.$disconnect(); await pool.end();
})().catch(e => { console.error('ERR', e); process.exit(1); });
