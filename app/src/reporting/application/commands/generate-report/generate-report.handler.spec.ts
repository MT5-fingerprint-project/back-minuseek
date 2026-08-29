import { InMemorySealRegistry } from '../../../../audit-trail/infrastructure/persistence/in-memory-seal-registry';
import { createHash } from 'node:crypto';
import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
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
  AnchorData,
  AuditEventData,
  TraceabilityData,
  TraceabilityDataReader,
} from '../../ports/traceability-data.reader';
import type {
  CaseContributorData,
  CaseContributorsReader,
} from '../../ports/case-contributors.reader';
import type {
  ReportNumberingData,
  ReportNumberingReader,
} from '../../ports/report-numbering.reader';
import type { ReportSignerData } from '../../report-signer';
import type {
  ServiceLetterheadData,
  ServiceLetterheadReader,
} from '../../ports/service-letterhead.reader';
import { ReportSequenceAlreadyTakenError } from '../../../domain/report/errors/report-sequence-already-taken.error';
import { ReportTypeName } from '../../../domain/report/entity/report';
import type { ReportImageEmbedderPort } from '../../ports/report-image-embedder.port';
import type { ReportImageViewModel } from '../../report-view-model';
import { GenerateReportCommand } from './generate-report.command';
import { GenerateReportHandler } from './generate-report.handler';

const EXPERT = AuditActor.user({
  sub: 'sub-1',
  username: 'amartin',
  displayName: 'Alex Martin',
});
const CASE_ID = 'case-1';
const SIGNER_ID = '3f2b1c40-0000-4000-8000-000000000001';
const SIGNER: ReportSignerData = {
  id: SIGNER_ID,
  grade: 'Technicien en Chef de Police Technique et Scientifique',
  firstName: 'Sébastien',
  lastName: 'Aguilar',
  serviceNumber: '118 402',
};
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
    requestDate: null,
    requesterQuality: null,
    requesterName: null,
    requesterService: null,
    offenseNature: null,
    offenseLocation: null,
    offenseDateFrom: null,
    offenseDateTo: null,
    interventionDate: null,
    caseAgainst: null,
    recipient: {
      authority: null,
      attentionQuality: null,
      attentionName: null,
    },
  },
  traces: [
    {
      id: 'trace-1',
      path: TRACE_PATH,
      sha256: 'a'.repeat(64),
      displayableSha256: 'a'.repeat(64),
      createdAt: new Date('2026-08-01T10:00:00.000Z'),
      capturedAt: null,
      status: 'EXPLOITABLE',
      subjectId: null,
      position: null,
      layers: [],
      minutiae: [],
      withdrawnAt: null,
      withdrawalMotive: null,
      imageDestroyedAt: null,
      number: 1,
      origin: null,
      location: null,
      revelationTechnique: null,
      cote: null,
      notIdentifiedAt: null,
    },
  ],
  referencePrints: [
    {
      id: 'ref-1',
      path: REF_PATH,
      sha256: null,
      displayableSha256: null,
      createdAt: new Date('2026-08-01T11:00:00.000Z'),
      capturedAt: null,
      status: null,
      subjectId: null,
      position: null,
      layers: [],
      minutiae: [],
      withdrawnAt: null,
      withdrawalMotive: null,
      imageDestroyedAt: null,
      number: null,
      origin: null,
      location: null,
      revelationTechnique: null,
      cote: null,
      notIdentifiedAt: null,
    },
  ],
  comparisons: [],
  declaredHits: [],
  subjects: [],
  minutiaPairs: [],
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
  readonly caseEvents: AuditEventData[] = [];
  caseEventsReadFor: string[] = [];

  read(): Promise<TraceabilityData> {
    return Promise.resolve(TRACEABILITY_DATA);
  }

  readCaseEvents(caseId: string): Promise<AuditEventData[]> {
    this.caseEventsReadFor.push(caseId);
    return Promise.resolve(this.caseEvents);
  }

  readAnchors(): Promise<AnchorData[]> {
    return Promise.resolve(TRACEABILITY_DATA.anchors);
  }
}

class FakeImageEmbedder implements ReportImageEmbedderPort {
  readonly images = new Map<string, ReportImageViewModel>();
  readonly embedded: string[] = [];

  embed(storedPath: string): Promise<ReportImageViewModel | null> {
    this.embedded.push(storedPath);
    return Promise.resolve(this.images.get(storedPath) ?? null);
  }
}

class FakeAttestation implements ChainAttestationPort {
  calls = 0;

  attest(): Promise<ChainAttestation> {
    this.calls += 1;
    return Promise.resolve(ATTESTATION);
  }
}

class FakeChainHeadReader implements ChainHeadReader {
  read(): Promise<ChainHeadSummary | null> {
    return Promise.resolve({ seq: 12, hash: 'c'.repeat(64) });
  }
}

/**
 * Le double numérote comme le lecteur Prisma : la plus grande séquence du
 * dossier tous types confondus, et le dernier document du même type.
 */
class FakeReportNumberingReader implements ReportNumberingReader {
  constructor(private readonly repository: InMemoryReportRepository) {}

  read(caseId: string, type: ReportTypeName): Promise<ReportNumberingData> {
    const ofCase = this.repository.store
      .map((report) => report.toPrimitives())
      .filter((report) => report.caseId === caseId);
    const previous = ofCase
      .filter((report) => report.type === type)
      .sort((left, right) => right.sequence - left.sequence)[0];

    return Promise.resolve({
      lastSequence: ofCase.reduce(
        (highest, report) => Math.max(highest, report.sequence),
        0,
      ),
      previousOfType: previous
        ? { number: previous.number, issuedAt: previous.createdAt }
        : null,
    });
  }
}

class FakeServiceLetterheadReader implements ServiceLetterheadReader {
  settings: ServiceLetterheadData = {
    administration: 'Ministère de l’Intérieur',
    serviceName: 'Service Régional de Police Technique et Scientifique',
    postalAddress: '36 rue du Bastion — 75017 Paris',
    phoneNumber: '01 40 79 00 00',
    email: 'srpts-paris@interieur.gouv.fr',
    signatureCity: 'Paris',
  };

  read(): Promise<ServiceLetterheadData> {
    return Promise.resolve(this.settings);
  }
}

class FakeCaseContributorsReader implements CaseContributorsReader {
  contributors: CaseContributorData[] = [];
  readFor: string[] = [];

  read(caseId: string): Promise<CaseContributorData[]> {
    this.readFor.push(caseId);
    return Promise.resolve(this.contributors);
  }
}

describe('GenerateReportHandler', () => {
  let handler: GenerateReportHandler;
  let caseData: FakeCaseDataReader;
  let renderer: InMemoryReportRenderer;
  let storage: InMemoryReportStorageAdapter;
  let repository: InMemoryReportRepository;
  let appender: InMemoryAuditTrailAppender;
  let traceability: FakeTraceabilityReader;
  let imageEmbedder: FakeImageEmbedder;
  let contributors: FakeCaseContributorsReader;
  let letterhead: FakeServiceLetterheadReader;
  let attestation: FakeAttestation;
  let sealRegistry: InMemorySealRegistry;

  beforeEach(() => {
    sealRegistry = new InMemorySealRegistry();
    caseData = new FakeCaseDataReader();
    traceability = new FakeTraceabilityReader();
    imageEmbedder = new FakeImageEmbedder();
    renderer = new InMemoryReportRenderer();
    storage = new InMemoryReportStorageAdapter();
    appender = new InMemoryAuditTrailAppender();
    repository = new InMemoryReportRepository(appender);
    contributors = new FakeCaseContributorsReader();
    letterhead = new FakeServiceLetterheadReader();
    let issued = 0;
    attestation = new FakeAttestation();
    handler = new GenerateReportHandler(
      caseData,
      traceability,
      attestation,
      new FakeChainHeadReader(),
      new FakeReportNumberingReader(repository),
      contributors,
      letterhead,
      { build: () => 'https://minuseek.fr/demo/verifier' },
      imageEmbedder,
      renderer,
      storage,
      repository,
      { generate: () => `report-${++issued}` },
      sealRegistry,
    );
  });

  function generate(type: ReportTypeName = 'TECHNICAL') {
    return handler.execute(
      new GenerateReportCommand(EXPERT, CASE_ID, type, SIGNER),
    );
  }

  it('refuse de rapporter un dossier qui n existe pas', async () => {
    caseData.data = null;

    await expect(
      handler.execute(
        new GenerateReportCommand(EXPERT, CASE_ID, 'TECHNICAL', SIGNER),
      ),
    ).rejects.toThrow(CASE_ID);
    expect(storage.files.size).toBe(0);
    expect(appender.events).toHaveLength(0);
  });

  it('scelle le rapport technique : stockage, persistance et maillon de chaîne', async () => {
    const generated = await generate();

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

  it('embarque les pièces lisibles avec leurs dimensions, et signale les autres', async () => {
    imageEmbedder.images.set(TRACE_PATH, {
      dataUrl: 'data:image/png;base64,AAA',
      width: 800,
      height: 1200,
      observedSha256: 'e'.repeat(64),
    });

    await generate();

    const model = renderer.rendered[0];
    if (model.kind !== 'TECHNICAL') throw new Error('modèle inattendu');
    expect(model.traces[0].image).toEqual({
      dataUrl: 'data:image/png;base64,AAA',
      width: 800,
      height: 1200,
      observedSha256: 'e'.repeat(64),
    });
    expect(model.referencePrints[0].image).toBeNull();
  });

  it('lit les maillons du dossier pour le journal du rapport technique', async () => {
    await generate();

    expect(traceability.caseEventsReadFor).toEqual([CASE_ID]);
    const model = renderer.rendered[0];
    if (model.kind !== 'TECHNICAL') throw new Error('modèle inattendu');
    expect(model.journal.acts).toEqual([]);
    expect(model.journal.detail).toBe('SUMMARY');
  });

  it('rattache le document au maillon de chaîne du moment', async () => {
    await generate();

    expect(renderer.rendered[0].header).toMatchObject({
      reportId: 'report-1',
      chainHeadSeq: 12,
      chainHeadHash: 'c'.repeat(64),
      generatedByDisplayName: 'Alex Martin',
    });
  });

  it("produit l'annexe avec l'attestation du vérificateur et l'épine de hashes", async () => {
    await generate('TRACEABILITY');

    const model = renderer.rendered[0];
    if (model.kind !== 'TRACEABILITY') throw new Error('modèle inattendu');
    expect(model.attestation).toEqual(ATTESTATION);
    expect(model.hashSpine).toEqual([{ seq: 1, hash: 'b'.repeat(64) }]);
    expect(model.header.caseNumber).toBe('AFF-001');
  });
  it('numérote le premier rapport du dossier, puis le suivant', async () => {
    await generate();
    await generate();

    expect(
      repository.store.map((report) => report.toPrimitives().number),
    ).toEqual(['AFF-001-R1', 'AFF-001-R2']);
  });

  it('imprime le numéro dans le modèle passé au rendu', async () => {
    await generate();

    expect(renderer.rendered[0].header.reportNumber).toBe('AFF-001-R1');
  });

  it('scelle le signataire choisi sur la ligne du rapport', async () => {
    await generate();

    expect(repository.store[0].toPrimitives()).toMatchObject({
      sequence: 1,
      number: 'AFF-001-R1',
      signerUserId: SIGNER_ID,
    });
  });

  it('n’annonce aucun document antérieur au premier rapport du dossier', async () => {
    await generate();

    const model = renderer.rendered[0];
    if (model.kind !== 'TECHNICAL') throw new Error('modèle inattendu');
    expect(model.previousDocument).toBeNull();
  });

  it('fait succéder le second rapport au premier', async () => {
    await generate();
    await generate();

    const model = renderer.rendered[1];
    if (model.kind !== 'TECHNICAL') throw new Error('modèle inattendu');
    expect(model.previousDocument).toEqual({
      number: 'AFF-001-R1',
      issuedAt: repository.store[0].toPrimitives().createdAt,
    });
  });

  it('une annexe éditée entre deux rapports consomme un numéro sans devenir leur antérieur', async () => {
    await generate();
    await generate('TRACEABILITY');
    await generate();

    expect(
      repository.store.map((report) => report.toPrimitives().number),
    ).toEqual(['AFF-001-R1', 'AFF-001-R2', 'AFF-001-R3']);
    const model = renderer.rendered[2];
    if (model.kind !== 'TECHNICAL') throw new Error('modèle inattendu');
    expect(model.previousDocument?.number).toBe('AFF-001-R1');
  });

  it('lit les auteurs du dossier pour la phrase « ont concouru »', async () => {
    contributors.contributors = [
      {
        userId: 'user-guichard',
        grade: 'Agent Spécialisé de Police Technique et Scientifique',
        displayName: 'GUICHARD Lucile',
      },
    ];

    await generate();

    expect(contributors.readFor).toEqual([CASE_ID]);
    const model = renderer.rendered[0];
    if (model.kind !== 'TECHNICAL') throw new Error('modèle inattendu');
    expect(model.contributors).toHaveLength(1);
  });
  it('refuse deux rapports sur le même numéro : c’est la contrainte d’unicité qui tranche', async () => {
    // Deux générations concurrentes lisent la même plus grande séquence : la
    // seconde vise un numéro déjà pris et doit être renvoyée à l’appelant.
    const stale: ReportNumberingReader = {
      read: () => Promise.resolve({ lastSequence: 0, previousOfType: null }),
    };
    handler = new GenerateReportHandler(
      caseData,
      traceability,
      new FakeAttestation(),
      new FakeChainHeadReader(),
      stale,
      contributors,
      letterhead,
      { build: () => 'https://minuseek.fr/demo/verifier' },
      imageEmbedder,
      renderer,
      storage,
      repository,
      { generate: () => `report-${repository.store.length + 1}` },
      sealRegistry,
    );

    await generate();

    await expect(generate()).rejects.toThrow(ReportSequenceAlreadyTakenError);
    expect(repository.store).toHaveLength(1);
  });
  it('imprime l’en-tête du service sur les deux documents scellés', async () => {
    await generate();
    await generate('TRACEABILITY');

    expect(renderer.rendered[0].header.letterhead).toMatchObject({
      serviceName: 'Service Régional de Police Technique et Scientifique',
    });
    expect(renderer.rendered[1].header.letterhead).toEqual(
      renderer.rendered[0].header.letterhead,
    );
    expect(renderer.rendered[0].header.signatureCity).toBe('Paris');
  });

  it('édite l’annexe résumée quand la commande ne demande rien', async () => {
    await handler.execute(
      new GenerateReportCommand(EXPERT, CASE_ID, 'TECHNICAL', SIGNER),
    );

    const model = renderer.rendered[0];
    if (model.kind !== 'TECHNICAL') throw new Error('modèle inattendu');
    expect(model.journal.detail).toBe('SUMMARY');
    expect(repository.store[0].toPrimitives().journalDetail).toBe('SUMMARY');
  });

  it('édite le journal détaillé quand la commande le demande', async () => {
    await handler.execute(
      new GenerateReportCommand(EXPERT, CASE_ID, 'TECHNICAL', SIGNER, 'FULL'),
    );

    const model = renderer.rendered[0];
    if (model.kind !== 'TECHNICAL') throw new Error('modèle inattendu');
    expect(model.journal.detail).toBe('FULL');
  });

  it('scelle la variante sur la ligne du rapport : chaque édition garde la sienne', async () => {
    await handler.execute(
      new GenerateReportCommand(EXPERT, CASE_ID, 'TECHNICAL', SIGNER, 'FULL'),
    );

    expect(repository.store[0].toPrimitives().journalDetail).toBe('FULL');
  });

  it('lit les ancres et l’attestation pour un rapport d’exploitation', async () => {
    await handler.execute(
      new GenerateReportCommand(EXPERT, CASE_ID, 'TECHNICAL', SIGNER),
    );

    expect(attestation.calls).toBe(1);
    const model = renderer.rendered[0];
    if (model.kind !== 'TECHNICAL') throw new Error('modèle inattendu');
    expect(model.integrity.recordVerifiedAtEdition).toBe(true);
    expect(model.integrity.verificationUrl).toBe(
      'https://minuseek.fr/demo/verifier',
    );
  });

  it('décrit chaque pièce du dossier dans la section d’intégrité', async () => {
    await handler.execute(
      new GenerateReportCommand(EXPERT, CASE_ID, 'TECHNICAL', SIGNER),
    );

    const model = renderer.rendered[0];
    if (model.kind !== 'TECHNICAL') throw new Error('modèle inattendu');
    expect(model.integrity.traces).toHaveLength(1);
    expect(model.integrity.referencePrints).toHaveLength(1);
  });

  it('n’embarque pas l’image d’une trace inexploitable que personne n’a identifiée', async () => {
    caseData.data = {
      ...CASE_DATA,
      traces: [
        {
          ...CASE_DATA.traces[0],
          status: 'NOT_EXPLOITABLE',
        },
      ],
    };
    imageEmbedder.images.set(TRACE_PATH, {
      dataUrl: 'data:image/png;base64,AAA',
      width: 800,
      height: 1200,
      observedSha256: null,
    });

    await generate();

    expect(imageEmbedder.embedded).toEqual([]);
    const model = renderer.rendered[0];
    if (model.kind !== 'TECHNICAL') throw new Error('modèle inattendu');
    expect(model.traces[0].image).toBeNull();
  });

  it('projette le scellé du rapport au registre public, avec sa nature', async () => {
    const generated = await handler.execute(
      new GenerateReportCommand(EXPERT, CASE_ID, 'TECHNICAL', SIGNER),
    );

    const link = appender.events.at(-1);
    expect(sealRegistry.seals).toEqual([
      {
        tenantSlug: 'demo',
        sha256: generated.sha256,
        kind: 'REPORT',
        chainSeq: link?.seq,
        sealedAt: link?.occurredAt,
        caseId: CASE_ID,
        reportType: 'TECHNICAL',
        anchoredAt: null,
      },
    ]);
  });

  it('distingue la nature du document projeté', async () => {
    await handler.execute(
      new GenerateReportCommand(EXPERT, CASE_ID, 'TRACEABILITY', SIGNER),
    );

    expect(sealRegistry.seals[0].reportType).toBe('TRACEABILITY');
  });

  it('ne perd pas un rapport scellé quand la projection échoue', async () => {
    sealRegistry.failWith = new Error("base d'administration injoignable");

    const generated = await handler.execute(
      new GenerateReportCommand(EXPERT, CASE_ID, 'TECHNICAL', SIGNER),
    );

    expect(generated.id).toBe('report-1');
    expect(repository.store).toHaveLength(1);
    expect(appender.events).toHaveLength(1);
  });
});
