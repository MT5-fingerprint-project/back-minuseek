import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { InMemoryFingerprintLocatorAdapter } from '../../../infrastructure/persistence/in-memory-fingerprint-locator.adapter';
import { InMemoryExportedImageRepository } from '../../../infrastructure/persistence/in-memory-exported-image.repository';
import { InMemoryImageStorageAdapter } from '../../../infrastructure/storage/in-memory-image-storage.adapter';
import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { InMemorySealRegistry } from '../../../../audit-trail/infrastructure/persistence/in-memory-seal-registry';
import { ExportSourcePieceNotFoundError } from '../../../domain/exported-image/errors/export-source-piece-not-found.error';
import { UnsupportedExportFormatError } from '../../../domain/exported-image/errors/unsupported-export-format.error';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator';
import { DepositExportedImageCommand } from './deposit-exported-image.command';
import { DepositExportedImageHandler } from './deposit-exported-image.handler';

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 1, 2, 3]);
const TIFF_BYTES = Buffer.from([0x49, 0x49, 0x2a, 0x00, 1, 2, 3]);

describe('DepositExportedImageHandler', () => {
  let repo: InMemoryExportedImageRepository;
  let storage: InMemoryImageStorageAdapter;
  let locator: InMemoryFingerprintLocatorAdapter;
  let idGenerator: IdGenerator;
  let auditTrail: InMemoryAuditTrailAppender;
  let sealRegistry: InMemorySealRegistry;
  let handler: DepositExportedImageHandler;
  let nextId: string;

  beforeEach(() => {
    auditTrail = new InMemoryAuditTrailAppender();
    repo = new InMemoryExportedImageRepository(auditTrail);
    storage = new InMemoryImageStorageAdapter();
    locator = new InMemoryFingerprintLocatorAdapter();
    sealRegistry = new InMemorySealRegistry();
    nextId = 'export-1';
    idGenerator = { generate: jest.fn(() => nextId) };
    handler = new DepositExportedImageHandler(
      repo,
      storage,
      idGenerator,
      locator,
      sealRegistry,
    );
  });

  it("dépose l'export d'une trace : réglages, acte et retour", async () => {
    locator.setTrace('trace-1', 'case-1');

    const result = await handler.execute(
      new DepositExportedImageCommand(
        EXPERT_ACTOR,
        'case-1',
        'trace-1',
        PNG_BYTES,
      ),
    );

    expect(result.id).toBe('export-1');
    expect(result.path).toBe(
      'media/investigation-case/case-1/exports/export-1.png',
    );
    expect(result.url).toBe(
      '/media/investigation-case/case-1/exports/export-1.png',
    );
    expect(result.sha256).toHaveLength(64);

    const [saved] = await repo.findBySourcePieceId('trace-1');
    expect(saved.toPrimitives()).toMatchObject({
      id: 'export-1',
      caseId: 'case-1',
      sourcePieceId: 'trace-1',
      sourceKind: 'TRACE',
      sha256: result.sha256,
    });

    const [act] = auditTrail.events;
    expect(act.eventType).toBe(AuditEventTypeEnum.EXPORTED_IMAGE_DEPOSITED);
    expect(act.evidenceClass).toBe(EvidenceClassEnum.OBSERVED);
    expect(act.caseId).toBe('case-1');
    expect(act.traceId).toBe('trace-1');
    expect(act.payload).toMatchObject({
      sourcePieceId: 'trace-1',
      sourceKind: 'TRACE',
      fileSha256: result.sha256,
      sizeBytes: PNG_BYTES.length,
      mimeType: 'image/png',
    });
  });

  it('projette le scellé de l’export au registre public, avec son maillon', async () => {
    locator.setTrace('trace-1', 'case-1');

    const result = await handler.execute(
      new DepositExportedImageCommand(
        EXPERT_ACTOR,
        'case-1',
        'trace-1',
        PNG_BYTES,
      ),
    );

    const link = auditTrail.events.at(-1);
    expect(sealRegistry.seals).toEqual([
      {
        tenantSlug: 'demo',
        sha256: result.sha256,
        kind: 'EXPORTED_IMAGE',
        chainSeq: link?.seq,
        sealedAt: link?.occurredAt,
        caseId: 'case-1',
        reportType: null,
        anchoredAt: null,
      },
    ]);
  });

  it('ne perd pas un dépôt réussi quand la projection du scellé échoue', async () => {
    locator.setTrace('trace-1', 'case-1');
    sealRegistry.failWith = new Error("base d'administration injoignable");

    const result = await handler.execute(
      new DepositExportedImageCommand(
        EXPERT_ACTOR,
        'case-1',
        'trace-1',
        PNG_BYTES,
      ),
    );

    expect(result.id).toBe('export-1');
    expect(await repo.findBySourcePieceId('trace-1')).toHaveLength(1);
  });

  it("dépose l'export d'une empreinte de référence : pas de traceId sur l'acte", async () => {
    locator.setReferencePrint('ref-1', 'case-1');

    await handler.execute(
      new DepositExportedImageCommand(
        EXPERT_ACTOR,
        'case-1',
        'ref-1',
        PNG_BYTES,
      ),
    );

    const [act] = auditTrail.events;
    expect(act.traceId).toBeNull();
    expect(act.payload.sourceKind).toBe('REFERENCE_PRINT');

    const [saved] = await repo.findBySourcePieceId('ref-1');
    expect(saved.toPrimitives().sourceKind).toBe('REFERENCE_PRINT');
  });

  it("refuse une pièce d'origine inconnue, sans rien écrire", async () => {
    await expect(
      handler.execute(
        new DepositExportedImageCommand(
          EXPERT_ACTOR,
          'case-1',
          'unknown',
          PNG_BYTES,
        ),
      ),
    ).rejects.toThrow(ExportSourcePieceNotFoundError);

    expect(auditTrail.events).toHaveLength(0);
    expect(
      storage.getSaved('investigation-case/case-1/exports/export-1.png'),
    ).toBeUndefined();
  });

  it("refuse une pièce d'origine appartenant à un autre dossier, avec la même erreur (IDOR)", async () => {
    locator.setTrace('trace-1', 'other-case');

    await expect(
      handler.execute(
        new DepositExportedImageCommand(
          EXPERT_ACTOR,
          'case-1',
          'trace-1',
          PNG_BYTES,
        ),
      ),
    ).rejects.toThrow(ExportSourcePieceNotFoundError);

    expect(auditTrail.events).toHaveLength(0);
  });

  it("refuse un format qui n'est ni PNG ni JPEG, sans rien écrire", async () => {
    locator.setTrace('trace-1', 'case-1');

    await expect(
      handler.execute(
        new DepositExportedImageCommand(
          EXPERT_ACTOR,
          'case-1',
          'trace-1',
          TIFF_BYTES,
        ),
      ),
    ).rejects.toThrow(UnsupportedExportFormatError);

    expect(auditTrail.events).toHaveLength(0);
    expect(
      storage.getSaved('investigation-case/case-1/exports/export-1.tif'),
    ).toBeUndefined();
  });

  it('produit deux pièces distinctes pour deux exports successifs de la même vue', async () => {
    locator.setTrace('trace-1', 'case-1');

    nextId = 'export-1';
    const first = await handler.execute(
      new DepositExportedImageCommand(
        EXPERT_ACTOR,
        'case-1',
        'trace-1',
        PNG_BYTES,
      ),
    );
    nextId = 'export-2';
    const second = await handler.execute(
      new DepositExportedImageCommand(
        EXPERT_ACTOR,
        'case-1',
        'trace-1',
        PNG_BYTES,
      ),
    );

    expect(first.id).not.toBe(second.id);
    expect(first.path).not.toBe(second.path);
    expect(await repo.findBySourcePieceId('trace-1')).toHaveLength(2);
  });

  it("supprime le fichier stocké et relance l'erreur quand l'enregistrement échoue", async () => {
    locator.setTrace('trace-1', 'case-1');
    jest.spyOn(repo, 'save').mockRejectedValue(new Error('db down'));

    await expect(
      handler.execute(
        new DepositExportedImageCommand(
          EXPERT_ACTOR,
          'case-1',
          'trace-1',
          PNG_BYTES,
        ),
      ),
    ).rejects.toThrow('db down');

    expect(
      storage.getSaved('investigation-case/case-1/exports/export-1.png'),
    ).toBeUndefined();
  });

  it("garde l'erreur d'origine même si la suppression compensatoire échoue aussi", async () => {
    locator.setTrace('trace-1', 'case-1');
    jest.spyOn(repo, 'save').mockRejectedValue(new Error('db down'));
    jest
      .spyOn(storage, 'delete')
      .mockRejectedValue(new Error('storage unreachable'));

    await expect(
      handler.execute(
        new DepositExportedImageCommand(
          EXPERT_ACTOR,
          'case-1',
          'trace-1',
          PNG_BYTES,
        ),
      ),
    ).rejects.toThrow('db down');
  });
});
