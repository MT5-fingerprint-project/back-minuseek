import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { ANY_SEAL } from '../../../domain/file-digest.fixture';
import { ReferencePrint } from '../../../domain/reference-print/entity/reference-print';
import { ReferencePrintNotFoundError } from '../../../domain/reference-print/errors/reference-print-not-found.error';
import { NotWithdrawnError } from '../../../domain/withdrawal/errors/not-withdrawn.error';
import { InMemoryReferencePrintRepository } from '../../../infrastructure/persistence/in-memory-reference-print.repository';
import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { RestoreReferencePrintCommand } from './restore-reference-print.command';
import { RestoreReferencePrintHandler } from './restore-reference-print.handler';

const WITHDRAWN_AT = new Date('2026-08-12T09:00:00.000Z');

describe('RestoreReferencePrintHandler', () => {
  let handler: RestoreReferencePrintHandler;
  let repo: InMemoryReferencePrintRepository;
  let auditTrail: InMemoryAuditTrailAppender;

  const referencePrint = (): ReferencePrint =>
    ReferencePrint.create({
      id: 'ref-1',
      path: 'media/investigation-case/case-1/reference-prints/ref-1.png',
      caseId: 'case-1',
      sha256: ANY_SEAL,
    });

  beforeEach(() => {
    auditTrail = new InMemoryAuditTrailAppender();
    repo = new InMemoryReferencePrintRepository(auditTrail);
    handler = new RestoreReferencePrintHandler(repo);
  });

  it('brings a withdrawn reference print back to the working case', async () => {
    const withdrawn = referencePrint();
    withdrawn.withdraw('MISFILED', WITHDRAWN_AT);
    repo.seed(withdrawn);

    await handler.execute(
      new RestoreReferencePrintCommand(EXPERT_ACTOR, 'ref-1'),
    );

    expect((await repo.findById('ref-1'))?.isWithdrawn).toBe(false);
  });

  it('chains a REFERENCE_PRINT_RESTORED event carrying the date it cancels', async () => {
    const withdrawn = referencePrint();
    withdrawn.withdraw('MISFILED', WITHDRAWN_AT);
    repo.seed(withdrawn);

    await handler.execute(
      new RestoreReferencePrintCommand(EXPERT_ACTOR, 'ref-1'),
    );

    expect(auditTrail.events).toHaveLength(1);
    const [event] = auditTrail.events;
    expect(event.eventType).toBe(AuditEventTypeEnum.REFERENCE_PRINT_RESTORED);
    expect(event.evidenceClass).toBe(EvidenceClassEnum.OBSERVED);
    expect(event.actor).toEqual(EXPERT_ACTOR.toPrimitives());
    expect(event.caseId).toBe('case-1');
    expect(event.payload).toEqual({
      withdrawnAt: WITHDRAWN_AT.toISOString(),
    });
  });

  it('refuses a reference print that never left the case', async () => {
    repo.seed(referencePrint());

    await expect(
      handler.execute(new RestoreReferencePrintCommand(EXPERT_ACTOR, 'ref-1')),
    ).rejects.toBeInstanceOf(NotWithdrawnError);
    expect(auditTrail.events).toHaveLength(0);
  });

  it('chains nothing when the reference print does not exist', async () => {
    await expect(
      handler.execute(
        new RestoreReferencePrintCommand(EXPERT_ACTOR, 'missing'),
      ),
    ).rejects.toBeInstanceOf(ReferencePrintNotFoundError);

    expect(auditTrail.events).toHaveLength(0);
  });
});
