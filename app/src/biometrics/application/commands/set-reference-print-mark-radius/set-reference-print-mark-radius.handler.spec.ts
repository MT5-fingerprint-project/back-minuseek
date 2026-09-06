import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { InvalidMarkRadiusError } from '../../../domain/mark-radius.vo';
import { ANY_SEAL } from '../../../domain/file-digest.fixture';
import { CaseNotOpenForWorkError } from '../../../domain/errors/case-not-open-for-work.error';
import { CaseUnavailableForTraceError } from '../../../domain/trace/errors/case-unavailable-for-trace.error';
import { ReferencePrint } from '../../../domain/reference-print/entity/reference-print';
import { ReferencePrintNotFoundError } from '../../../domain/reference-print/errors/reference-print-not-found.error';
import { InMemoryCaseStatusAdapter } from '../../../infrastructure/persistence/in-memory-case-status.adapter';
import { InMemoryReferencePrintRepository } from '../../../infrastructure/persistence/in-memory-reference-print.repository';
import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { SetReferencePrintMarkRadiusCommand } from './set-reference-print-mark-radius.command';
import { SetReferencePrintMarkRadiusHandler } from './set-reference-print-mark-radius.handler';

const STORED_PATH =
  'media/investigation-case/case-1/reference-prints/ref-1.png';

describe('SetReferencePrintMarkRadiusHandler', () => {
  let handler: SetReferencePrintMarkRadiusHandler;
  let repo: InMemoryReferencePrintRepository;
  let caseStatus: InMemoryCaseStatusAdapter;
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
    caseStatus = new InMemoryCaseStatusAdapter();
    caseStatus.set('case-1', 'OPEN');
    handler = new SetReferencePrintMarkRadiusHandler(repo, caseStatus);
    repo.seed(seededPrint());
  });

  it('writes the marker size onto the reference print', async () => {
    await handler.execute(
      new SetReferencePrintMarkRadiusCommand(EXPERT_ACTOR, 'ref-1', 36),
    );

    const rp = await repo.findById('ref-1');
    expect(rp?.markRadius).toBe(36);
  });

  it('chains a MARK_RADIUS_SET event naming the piece and its new size', async () => {
    await handler.execute(
      new SetReferencePrintMarkRadiusCommand(EXPERT_ACTOR, 'ref-1', 36),
    );

    expect(auditTrail.events).toHaveLength(1);
    const [event] = auditTrail.events;
    expect(event.eventType).toBe(AuditEventTypeEnum.MARK_RADIUS_SET);
    expect(event.evidenceClass).toBe(EvidenceClassEnum.DECLARED);
    expect(event.actor).toEqual(EXPERT_ACTOR.toPrimitives());
    expect(event.caseId).toBe('case-1');
    expect(event.payload).toEqual({
      fingerprintId: 'ref-1',
      markRadius: 36,
      previousMarkRadius: null,
    });
  });

  it('carries both the previous and the new size on a correction', async () => {
    await handler.execute(
      new SetReferencePrintMarkRadiusCommand(EXPERT_ACTOR, 'ref-1', 36),
    );

    await handler.execute(
      new SetReferencePrintMarkRadiusCommand(EXPERT_ACTOR, 'ref-1', 48),
    );

    expect(auditTrail.events).toHaveLength(2);
    const [, second] = auditTrail.events;
    expect(second.payload).toEqual({
      fingerprintId: 'ref-1',
      markRadius: 48,
      previousMarkRadius: 36,
    });
  });

  it('rejects an unknown piece and chains nothing', async () => {
    await expect(
      handler.execute(
        new SetReferencePrintMarkRadiusCommand(EXPERT_ACTOR, 'missing', 36),
      ),
    ).rejects.toBeInstanceOf(ReferencePrintNotFoundError);

    expect(auditTrail.events).toHaveLength(0);
  });

  it('refuses to retouch the markers of a closed case, chains nothing and leaves the size untouched', async () => {
    await handler.execute(
      new SetReferencePrintMarkRadiusCommand(EXPERT_ACTOR, 'ref-1', 36),
    );
    caseStatus.set('case-1', 'CLOSED');

    await expect(
      handler.execute(
        new SetReferencePrintMarkRadiusCommand(EXPERT_ACTOR, 'ref-1', 48),
      ),
    ).rejects.toBeInstanceOf(CaseNotOpenForWorkError);

    expect(auditTrail.events).toHaveLength(1);
    const rp = await repo.findById('ref-1');
    expect(rp?.markRadius).toBe(36);
  });

  it('refuses a piece whose case is out of reach and chains nothing', async () => {
    repo.seed(
      ReferencePrint.create({
        id: 'ref-2',
        path: STORED_PATH,
        caseId: 'case-orphan',
        sha256: ANY_SEAL,
      }),
    );

    await expect(
      handler.execute(
        new SetReferencePrintMarkRadiusCommand(EXPERT_ACTOR, 'ref-2', 36),
      ),
    ).rejects.toBeInstanceOf(CaseUnavailableForTraceError);

    expect(auditTrail.events).toHaveLength(0);
  });

  it('refuses a size outside the accepted range, chains nothing and leaves the value untouched', async () => {
    await handler.execute(
      new SetReferencePrintMarkRadiusCommand(EXPERT_ACTOR, 'ref-1', 36),
    );

    await expect(
      handler.execute(
        new SetReferencePrintMarkRadiusCommand(EXPERT_ACTOR, 'ref-1', 1),
      ),
    ).rejects.toBeInstanceOf(InvalidMarkRadiusError);

    expect(auditTrail.events).toHaveLength(1);
    const rp = await repo.findById('ref-1');
    expect(rp?.markRadius).toBe(36);
  });
});
