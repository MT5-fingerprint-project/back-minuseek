import { createHash } from 'node:crypto';
import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { InMemoryTransactionRunner } from '../../../../tenancy/infrastructure/persistence/in-memory-transaction-runner';
import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { InMemoryReportRenderer } from '../../../infrastructure/pdf/in-memory-report.renderer';
import { InMemoryReportRepository } from '../../../infrastructure/persistence/in-memory-report.repository';
import { InMemoryReportStorageAdapter } from '../../../infrastructure/storage/in-memory-report-storage.adapter';
import type {
  CaseReportData,
  CaseReportDataReader,
} from '../../ports/case-report-data.reader';
import type {
  ChainAttestation,
  ChainAttestationPort,
} from '../../ports/chain-attestation.port';
import type {
  ChainHeadReader,
  ChainHeadSummary,
} from '../../ports/chain-head.reader';
import type {
  TraceabilityData,
  TraceabilityDataReader,
} from '../../ports/traceability-data.reader';
import { GenerateReportCommand } from './generate-report.command';
import { GenerateReportHandler } from './generate-report.handler';

const EXPERT = AuditActor.user({
  sub: 'sub-1',
  username: 'amartin',
  displayName: 'Alex Martin',
});
const CASE_ID = 'case-1';
const TRACE_PATH = 'media/investigation-case/case-1/traces/trace-1.png';
const REF_PATH = 'media/investigation-case/case-1/reference-prints/ref-1.jpg';

const CASE_DATA: CaseReportData = {
  investigationCase: {
    id: CASE_ID,
    caseNumber: 'AFF-001',
    pvNumber: 'PV-2026-001',
    description: null,
    status: 'OPEN',
    createdAt: new Date('2026-08-01T09:00:00.000Z'),
  },
  traces: [
    {
      id: 'trace-1',
      path: TRACE_PATH,
      sha256: 'a'.repeat(64),
      createdAt: new Date('2026-08-01T10:00:00.000Z'),
      capturedAt: null,
      status: 'EXPLOITABLE',
      score: 70,
      layers: [],
    },
  ],
  referencePrints: [
    {
      id: 'ref-1',
      path: REF_PATH,
      sha256: null,
      createdAt: new Date('2026-08-01T11:00:00.000Z'),
      capturedAt: null,
      status: null,
      score: null,
      layers: [],
    },
  ],
  comparisons: [],
};

const TRACEABILITY_DATA: TraceabilityData = {
  caseEvents: [],
  hashSpine: [{ seq: 1, hash: 'b'.repeat(64) }],
  anchors: [],
};

const ATTESTATION: ChainAttestation = {
  ok: true,
  eventsChecked: 1,
  firstBrokenSeq: null,
  anchorsVerified: 0,
  anchorsFailed: 0,
};

class FakeCaseDataReader implements CaseReportDataReader {
  data: CaseReportData | null = CASE_DATA;

  read(): Promise<CaseReportData | null> {
    return Promise.resolve(this.data);
  }
}

class FakeTraceabilityReader implements TraceabilityDataReader {
  read(): Promise<TraceabilityData> {
    return Promise.resolve(TRACEABILITY_DATA);
  }
}

class FakeAttestation implements ChainAttestationPort {
  attest(): Promise<ChainAttestation> {
    return Promise.resolve(ATTESTATION);
  }
}

class FakeChainHeadReader implements ChainHeadReader {
  read(): Promise<ChainHeadSummary | null> {
    return Promise.resolve({ seq: 12, hash: 'c'.repeat(64) });
  }
}

describe('GenerateReportHandler', () => {
  let handler: GenerateReportHandler;
  let caseData: FakeCaseDataReader;
  let renderer: InMemoryReportRenderer;
  let storage: InMemoryReportStorageAdapter;
  let repository: InMemoryReportRepository;
  let appender: InMemoryAuditTrailAppender;

  beforeEach(() => {
    caseData = new FakeCaseDataReader();
    renderer = new InMemoryReportRenderer();
    storage = new InMemoryReportStorageAdapter();
    repository = new InMemoryReportRepository();
    appender = new InMemoryAuditTrailAppender();
    handler = new GenerateReportHandler(
      caseData,
      new FakeTraceabilityReader(),
      new FakeAttestation(),
      new FakeChainHeadReader(),
      renderer,
      storage,
      repository,
      new InMemoryTransactionRunner(),
      appender,
      { generate: () => 'report-1' },
    );
  });

  it('refuse de rapporter un dossier qui n existe pas', async () => {
    caseData.data = null;

    await expect(
      handler.execute(new GenerateReportCommand(EXPERT, CASE_ID, 'TECHNICAL')),
    ).rejects.toThrow(CASE_ID);
    expect(storage.files.size).toBe(0);
    expect(appender.events).toHaveLength(0);
  });

  it('scelle le rapport technique : stockage, persistance et maillon de chaîne', async () => {
    const generated = await handler.execute(
      new GenerateReportCommand(EXPERT, CASE_ID, 'TECHNICAL'),
    );

    const pdf = Buffer.from('pdf:TECHNICAL');
    const expectedSha256 = createHash('sha256').update(pdf).digest('hex');
    expect(generated).toEqual({ id: 'report-1', sha256: expectedSha256 });
    expect([...storage.files.keys()]).toEqual([
      'media/reports/case-1/report-1.pdf',
    ]);
    expect(repository.store).toHaveLength(1);
    expect(repository.store[0].toPrimitives()).toMatchObject({
      id: 'report-1',
      caseId: CASE_ID,
      type: 'TECHNICAL',
      sha256: expectedSha256,
      storagePath: 'media/reports/case-1/report-1.pdf',
      generatedBy: EXPERT.toPrimitives(),
    });
    expect(appender.events).toHaveLength(1);
    expect(appender.events[0].eventType).toBe(
      AuditEventTypeEnum.REPORT_GENERATED,
    );
    expect(appender.events[0].caseId).toBe(CASE_ID);
    expect(appender.events[0].payload).toEqual({
      reportId: 'report-1',
      type: 'TECHNICAL',
      sha256: expectedSha256,
      storagePath: 'media/reports/case-1/report-1.pdf',
    });
  });

  it('embarque les pièces lisibles et signale les autres', async () => {
    await storage.save(Buffer.from('png'), 'lisible');
    storage.files.set(TRACE_PATH, Buffer.from('png'));

    await handler.execute(
      new GenerateReportCommand(EXPERT, CASE_ID, 'TECHNICAL'),
    );

    const model = renderer.rendered[0];
    if (model.kind !== 'TECHNICAL') throw new Error('modèle inattendu');
    expect(model.traces[0].imageDataUrl).toBe(
      `data:image/png;base64,${Buffer.from('png').toString('base64')}`,
    );
    expect(model.referencePrints[0].imageDataUrl).toBeNull();
  });

  it('rattache le document au maillon de chaîne du moment', async () => {
    await handler.execute(
      new GenerateReportCommand(EXPERT, CASE_ID, 'TECHNICAL'),
    );

    expect(renderer.rendered[0].header).toMatchObject({
      reportId: 'report-1',
      chainHeadSeq: 12,
      chainHeadHash: 'c'.repeat(64),
      generatedByDisplayName: 'Alex Martin',
    });
  });

  it("produit l'annexe avec l'attestation du vérificateur et l'épine de hashes", async () => {
    await handler.execute(
      new GenerateReportCommand(EXPERT, CASE_ID, 'TRACEABILITY'),
    );

    const model = renderer.rendered[0];
    if (model.kind !== 'TRACEABILITY') throw new Error('modèle inattendu');
    expect(model.attestation).toEqual(ATTESTATION);
    expect(model.hashSpine).toEqual([{ seq: 1, hash: 'b'.repeat(64) }]);
    expect(model.header.caseNumber).toBe('AFF-001');
  });
});
