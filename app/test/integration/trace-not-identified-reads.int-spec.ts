import { PrismaCaseReportDataReader } from '../../src/reporting/infrastructure/persistence/prisma-case-report-data.reader';
import { discriminationOf, verdictsByTraceId } from '../../src/reporting/application/queries/build-report/trace-verdicts';
import {
  AuditChainHarness,
  openAuditChainHarness,
} from './support/audit-chain-harness';

const CASE_ID = '44444444-4444-4444-8444-444444444444';
const DECLARED_TRACE_ID = '55555555-5555-4555-8555-555555555555';
const UNTOUCHED_TRACE_ID = '66666666-6666-4666-8666-666666666666';
const DECLARED_AT = new Date('2026-09-01T21:58:08.216Z');

describe('le rapport distingue une trace déclarée non identifiée d’une trace non examinée', () => {
  let harness: AuditChainHarness;

  beforeAll(async () => {
    harness = await openAuditChainHarness();
  });

  afterAll(async () => {
    await harness.close();
  });

  beforeEach(async () => {
    await harness.database.reset();
    const client = harness.database.client;
    await client.investigationCase.create({
      data: { id: CASE_ID, caseNumber: 'AFF-002', pvNumber: 'PV-002' },
    });
    await client.trace.create({
      data: {
        id: DECLARED_TRACE_ID,
        number: 1,
        path: `traces/${DECLARED_TRACE_ID}.png`,
        caseId: CASE_ID,
        status: 'EXPLOITABLE',
        notIdentifiedAt: DECLARED_AT,
      },
    });
    await client.trace.create({
      data: {
        id: UNTOUCHED_TRACE_ID,
        number: 2,
        path: `traces/${UNTOUCHED_TRACE_ID}.png`,
        caseId: CASE_ID,
        status: 'EXPLOITABLE',
      },
    });
  });

  it('projette la date de déclaration de non-identification', async () => {
    const reader = new PrismaCaseReportDataReader(harness.connection);

    const data = await harness.asTenant(() => reader.read(CASE_ID));

    const declared = data!.traces.find((t) => t.id === DECLARED_TRACE_ID);
    const untouched = data!.traces.find((t) => t.id === UNTOUCHED_TRACE_ID);
    expect(declared?.notIdentifiedAt).toEqual(DECLARED_AT);
    expect(untouched?.notIdentifiedAt).toBeNull();
  });

  it('imprime NÉGATIVE pour la trace déclarée, Non examinée pour l’autre', async () => {
    const reader = new PrismaCaseReportDataReader(harness.connection);

    const data = await harness.asTenant(() => reader.read(CASE_ID));

    const verdicts = verdictsByTraceId(data!);
    const declared = data!.traces.find((t) => t.id === DECLARED_TRACE_ID)!;
    const untouched = data!.traces.find((t) => t.id === UNTOUCHED_TRACE_ID)!;
    expect(discriminationOf(declared, verdicts.get(declared.id))).toBe(
      'NÉGATIVE',
    );
    expect(discriminationOf(untouched, verdicts.get(untouched.id))).toBe(
      'Non examinée',
    );
  });
});
