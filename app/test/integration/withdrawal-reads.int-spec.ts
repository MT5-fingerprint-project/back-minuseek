import { randomUUID } from 'node:crypto';
import { ListLayersHandler } from '../../src/biometrics/application/queries/list-layers/list-layers.handler';
import { ListLayersQuery } from '../../src/biometrics/application/queries/list-layers/list-layers.query';
import { PrismaFingerprintLocatorAdapter } from '../../src/biometrics/infrastructure/persistence/prisma-fingerprint-locator.adapter';
import { PrismaHitReader } from '../../src/biometrics/infrastructure/persistence/prisma-hit.reader';
import { PrismaLayerReader } from '../../src/biometrics/infrastructure/persistence/prisma-layer.reader';
import { PrismaReferencePrintReader } from '../../src/biometrics/infrastructure/persistence/prisma-reference-print.reader';
import { PrismaTraceReader } from '../../src/biometrics/infrastructure/persistence/prisma-trace.reader';
import { PrismaCaseReportDataReader } from '../../src/reporting/infrastructure/persistence/prisma-case-report-data.reader';
import {
  AuditChainHarness,
  openAuditChainHarness,
} from './support/audit-chain-harness';

const CASE_ID = '11111111-1111-4111-8111-111111111111';
const TRACE_ID = '22222222-2222-4222-8222-222222222222';
const REFERENCE_PRINT_ID = '33333333-3333-4333-8333-333333333333';
const WITHDRAWN_AT = new Date('2026-08-12T09:00:00.000Z');

describe('les lectures ignorent les pièces retirées, sauf le rapport', () => {
  let harness: AuditChainHarness;

  beforeAll(async () => {
    harness = await openAuditChainHarness();
  });

  afterAll(async () => {
    await harness.close();
  });

  beforeEach(async () => {
    await harness.database.reset();
    await seedWithdrawnCase();
  });

  async function seedWithdrawnCase(): Promise<void> {
    const client = harness.database.client;
    await client.investigationCase.create({
      data: { id: CASE_ID, caseNumber: 'AFF-001', pvNumber: 'PV-001' },
    });
    await client.trace.create({
      data: {
        id: TRACE_ID,
        number: 1,
        path: `traces/${TRACE_ID}.png`,
        caseId: CASE_ID,
        withdrawnAt: WITHDRAWN_AT,
        withdrawalMotive: 'DUPLICATE',
      },
    });
    await client.referencePrint.create({
      data: {
        id: REFERENCE_PRINT_ID,
        path: `reference-prints/${REFERENCE_PRINT_ID}.png`,
        caseId: CASE_ID,
        withdrawnAt: WITHDRAWN_AT,
        withdrawalMotive: 'MISFILED',
      },
    });
    await client.hit.create({
      data: {
        id: randomUUID(),
        traceId: TRACE_ID,
        referencePrintId: REFERENCE_PRINT_ID,
      },
    });
    await client.layer.create({
      data: {
        id: randomUUID(),
        fingerprintId: TRACE_ID,
        name: 'Contraste',
        type: 'FILTER',
        zIndex: 0,
        settings: { contrast: 1.4 },
      },
    });
  }

  it('ne rend pas une trace retirée à la liste du dossier', async () => {
    const reader = new PrismaTraceReader(harness.connection);

    const traces = await harness.asTenant(() => reader.findByCaseId(CASE_ID));

    expect(traces).toEqual([]);
  });

  it('ne rend pas une empreinte retirée à la liste du dossier', async () => {
    const reader = new PrismaReferencePrintReader(harness.connection);

    const prints = await harness.asTenant(() => reader.findByCaseId(CASE_ID));

    expect(prints).toEqual([]);
  });

  it("ne rend pas l'identification portée par une pièce retirée", async () => {
    const reader = new PrismaHitReader(harness.connection);

    const hits = await harness.asTenant(() => reader.findByTraceId(TRACE_ID));

    expect(hits).toEqual([]);
  });

  it('ne localise plus une pièce retirée', async () => {
    const locator = new PrismaFingerprintLocatorAdapter(harness.connection);

    await expect(
      harness.asTenant(() => locator.locate(TRACE_ID)),
    ).resolves.toBeNull();
    await expect(
      harness.asTenant(() => locator.locate(REFERENCE_PRINT_ID)),
    ).resolves.toBeNull();
  });

  it("ne rend aucun calque d'une pièce retirée", async () => {
    const handler = new ListLayersHandler(
      new PrismaLayerReader(harness.connection),
      new PrismaFingerprintLocatorAdapter(harness.connection),
    );

    const layers = await harness.asTenant(() =>
      handler.execute(new ListLayersQuery(TRACE_ID)),
    );

    expect(layers).toEqual([]);
  });

  it('rend au rapport les pièces retirées, avec leur date et leur motif', async () => {
    const reader = new PrismaCaseReportDataReader(harness.connection);

    const data = await harness.asTenant(() => reader.read(CASE_ID));

    expect(data?.traces).toHaveLength(1);
    expect(data?.traces[0]).toMatchObject({
      withdrawnAt: WITHDRAWN_AT,
      withdrawalMotive: 'DUPLICATE',
    });
    expect(data?.referencePrints[0]).toMatchObject({
      withdrawnAt: WITHDRAWN_AT,
      withdrawalMotive: 'MISFILED',
    });
  });

  it('refuse une date de retrait sans motif', async () => {
    await expect(
      harness.database.client.trace.create({
        data: {
          id: randomUUID(),
          number: 2,
          path: 'traces/orpheline.png',
          caseId: CASE_ID,
          withdrawnAt: WITHDRAWN_AT,
        },
      }),
    ).rejects.toThrow(/Trace_withdrawal_consistent/);
  });

  it('refuse de détruire une trace qui porte une identification déclarée', async () => {
    await expect(
      harness.database.client.$executeRawUnsafe(
        `DELETE FROM "Trace" WHERE id = '${TRACE_ID}'`,
      ),
    ).rejects.toThrow(/Hit_traceId_fkey/);
  });
});
