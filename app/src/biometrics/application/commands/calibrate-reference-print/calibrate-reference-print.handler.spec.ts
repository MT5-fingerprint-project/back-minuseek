import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { InvalidImageResolutionError } from '../../../domain/image-resolution.vo';
import { ANY_SEAL } from '../../../domain/file-digest.fixture';
import { ReferencePrint } from '../../../domain/reference-print/entity/reference-print';
import { ReferencePrintNotFoundError } from '../../../domain/reference-print/errors/reference-print-not-found.error';
import { InMemoryReferencePrintRepository } from '../../../infrastructure/persistence/in-memory-reference-print.repository';
import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { CalibrateReferencePrintCommand } from './calibrate-reference-print.command';
import { CalibrateReferencePrintHandler } from './calibrate-reference-print.handler';

const STORED_PATH =
  'media/investigation-case/case-1/reference-prints/ref-1.png';

describe('CalibrateReferencePrintHandler', () => {
  let handler: CalibrateReferencePrintHandler;
  let repo: InMemoryReferencePrintRepository;
  let auditTrail: InMemoryAuditTrailAppender;

  const seededPrint = () =>
    ReferencePrint.create({
      id: 'ref-1',
      path: STORED_PATH,
      caseId: 'case-1',
      sha256: ANY_SEAL,
    });

  beforeEach(() => {
    auditTrail = new InMemoryAuditTrailAppender();
    repo = new InMemoryReferencePrintRepository(auditTrail);
    handler = new CalibrateReferencePrintHandler(repo);
    repo.seed(seededPrint());
  });

  it('writes the resolution onto the reference print', async () => {
    await handler.execute(
      new CalibrateReferencePrintCommand(EXPERT_ACTOR, 'ref-1', 1207.34),
    );

    const rp = await repo.findById('ref-1');
    expect(rp?.resolutionDpi).toBe(1207.34);
  });

  it('chains a REFERENCE_PRINT_CALIBRATED event carrying the piece id and the resolution', async () => {
    await handler.execute(
      new CalibrateReferencePrintCommand(EXPERT_ACTOR, 'ref-1', 1207.34),
    );

    expect(auditTrail.events).toHaveLength(1);
    const [event] = auditTrail.events;
    expect(event.eventType).toBe(AuditEventTypeEnum.REFERENCE_PRINT_CALIBRATED);
    expect(event.evidenceClass).toBe(EvidenceClassEnum.DECLARED);
    expect(event.actor).toEqual(EXPERT_ACTOR.toPrimitives());
    expect(event.caseId).toBe('case-1');
    expect(event.traceId).toBeNull();
    expect(event.payload).toEqual({
      referencePrintId: 'ref-1',
      resolutionDpi: 1207.34,
      previousResolutionDpi: null,
    });
  });

  it('carries both the previous and the new resolution on a recalibration', async () => {
    await handler.execute(
      new CalibrateReferencePrintCommand(EXPERT_ACTOR, 'ref-1', 500),
    );

    await handler.execute(
      new CalibrateReferencePrintCommand(EXPERT_ACTOR, 'ref-1', 600),
    );

    expect(auditTrail.events).toHaveLength(2);
    const [, second] = auditTrail.events;
    expect(second.payload).toEqual({
      referencePrintId: 'ref-1',
      resolutionDpi: 600,
      previousResolutionDpi: 500,
    });
  });

  it('rejects an unknown piece and chains nothing', async () => {
    await expect(
      handler.execute(
        new CalibrateReferencePrintCommand(EXPERT_ACTOR, 'missing', 500),
      ),
    ).rejects.toBeInstanceOf(ReferencePrintNotFoundError);

    expect(auditTrail.events).toHaveLength(0);
  });

  it('refuses a resolution outside the accepted range, chains nothing and leaves the value untouched', async () => {
    await handler.execute(
      new CalibrateReferencePrintCommand(EXPERT_ACTOR, 'ref-1', 500),
    );

    await expect(
      handler.execute(
        new CalibrateReferencePrintCommand(EXPERT_ACTOR, 'ref-1', 3),
      ),
    ).rejects.toBeInstanceOf(InvalidImageResolutionError);

    expect(auditTrail.events).toHaveLength(1);
    const rp = await repo.findById('ref-1');
    expect(rp?.resolutionDpi).toBe(500);
  });
});
