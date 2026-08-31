import { DeclareTraceExploitabilityCommand } from '../../src/biometrics/application/commands/declare-trace-exploitability/declare-trace-exploitability.command';
import { DeclareTraceExploitabilityHandler } from '../../src/biometrics/application/commands/declare-trace-exploitability/declare-trace-exploitability.handler';
import { PrismaCaseStatusAdapter } from '../../src/biometrics/infrastructure/persistence/prisma-case-status.adapter';
import { PrismaTraceReader } from '../../src/biometrics/infrastructure/persistence/prisma-trace.reader';
import { PrismaTraceRepository } from '../../src/biometrics/infrastructure/persistence/prisma-trace.repository';
import { PrismaCaseReportDataReader } from '../../src/reporting/infrastructure/persistence/prisma-case-report-data.reader';
import { AuditActor } from '../../src/shared/domain/audit/audit-actor.vo';
import {
  AuditChainHarness,
  openAuditChainHarness,
} from './support/audit-chain-harness';

const CASE_ID = '11111111-1111-4111-8111-111111111111';
const TRACES = [
  '22222222-2222-4222-8222-000000000001',
  '22222222-2222-4222-8222-000000000002',
  '22222222-2222-4222-8222-000000000003',
  '22222222-2222-4222-8222-000000000004',
];

describe('la cote, de la déclaration au rapport, sur une vraie base', () => {
  let harness: AuditChainHarness;
  let handler: DeclareTraceExploitabilityHandler;

  const actor = AuditActor.user({
    sub: 'sub-probe',
    username: 'sonde',
    displayName: 'Sonde',
  });

  const declare = (index: number, exploitable: boolean) =>
    harness.asTenant(() =>
      handler.execute(
        new DeclareTraceExploitabilityCommand(
          actor,
          TRACES[index],
          exploitable,
        ),
      ),
    );

  const cotes = () =>
    harness.asTenant(async () =>
      (await new PrismaTraceReader(harness.connection).findByCaseId(CASE_ID))
        .sort((left, right) => left.number - right.number)
        .map((trace) => trace.cote),
    );

  beforeAll(async () => {
    harness = await openAuditChainHarness();
    handler = new DeclareTraceExploitabilityHandler(
      new PrismaTraceRepository(
        harness.connection,
        harness.runner,
        harness.appender,
      ),
      new PrismaCaseStatusAdapter(harness.connection),
    );
  });

  afterAll(async () => {
    await harness.close();
  });

  beforeEach(async () => {
    await harness.database.reset();
    const client = harness.database.client;
    await client.investigationCase.create({
      data: { id: CASE_ID, caseNumber: 'AFF-001', pvNumber: 'PV-001' },
    });
    for (const [index, id] of TRACES.entries()) {
      await client.trace.create({
        data: {
          id,
          number: index + 1,
          path: `traces/${id}.png`,
          caseId: CASE_ID,
        },
      });
    }
  });

  it('cote A, B, C au fil des déclarations et décale sur requalification', async () => {
    expect(await cotes()).toEqual([null, null, null, null]);

    await declare(0, true);
    await declare(1, false);
    await declare(2, true);
    await declare(3, true);

    expect(await cotes()).toEqual(['A', null, 'B', 'C']);

    await declare(2, false);

    expect(await cotes()).toEqual(['A', null, null, 'B']);
  });

  it('chaîne un acte par déclaration, sans jamais y mettre la cote', async () => {
    await declare(0, true);
    await declare(0, false);
    await declare(0, true);

    const events = await harness.database.client.auditEvent.findMany({
      where: { eventType: 'TRACE_QUALIFIED' },
      orderBy: { seq: 'asc' },
    });

    expect(events.map((event) => event.payload)).toEqual([
      { exploitable: true },
      { exploitable: false },
      { exploitable: true },
    ]);
  });

  it('donne au rapport la cote que la lecture expose', async () => {
    await declare(0, true);
    await declare(1, true);

    const data = await harness.asTenant(() =>
      new PrismaCaseReportDataReader(harness.connection).read(CASE_ID),
    );

    expect(data?.traces.map((trace) => [trace.number, trace.cote])).toEqual([
      [1, 'A'],
      [2, 'B'],
      [3, null],
      [4, null],
    ]);
  });
});
