import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { ANY_SEAL } from '../../../domain/file-digest.fixture';
import {
  Trace,
  MAX_TRACE_LOCATION_LENGTH,
} from '../../../domain/trace/entity/trace';
import { InvalidTraceLocationError } from '../../../domain/trace/errors/invalid-trace-location.error';
import { TraceNotFoundError } from '../../../domain/trace/errors/trace-not-found.error';
import { CaseNotOpenForWorkError } from '../../../domain/errors/case-not-open-for-work.error';
import { InvalidRevelationTechniqueError } from '../../../domain/trace/value-objects/revelation-technique.vo';
import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { InMemoryCaseStatusAdapter } from '../../../infrastructure/persistence/in-memory-case-status.adapter';
import { InMemoryTraceRepository } from '../../../infrastructure/persistence/in-memory-trace.repository';
import { DescribeTraceCommand } from './describe-trace.command';
import { DescribeTraceHandler } from './describe-trace.handler';

const STORED_PATH = 'media/investigation-case/case-1/traces/trace-1.png';
const LOCATION = "Sur l'extérieur de la porte d'entrée de l'appartement";

describe('DescribeTraceHandler', () => {
  let handler: DescribeTraceHandler;
  let repo: InMemoryTraceRepository;
  let caseStatus: InMemoryCaseStatusAdapter;
  let auditTrail: InMemoryAuditTrailAppender;

  const seededTrace = () =>
    Trace.upload({
      id: 'trace-1',
      number: 1,
      path: STORED_PATH,
      caseId: 'case-1',
      sha256: ANY_SEAL,
    });

  const describeTrace = (
    overrides: Partial<{
      id: string;
      origin: string;
      location: string;
      revelationTechnique: string;
    }> = {},
  ) =>
    new DescribeTraceCommand(
      EXPERT_ACTOR,
      overrides.id ?? 'trace-1',
      overrides.origin ?? 'DIGITAL',
      overrides.location ?? LOCATION,
      overrides.revelationTechnique ?? 'FINGERPRINT_POWDER',
    );

  beforeEach(() => {
    auditTrail = new InMemoryAuditTrailAppender();
    repo = new InMemoryTraceRepository(auditTrail);
    caseStatus = new InMemoryCaseStatusAdapter();
    caseStatus.set('case-1', 'OPEN');
    handler = new DescribeTraceHandler(repo, caseStatus);
    repo.seed(seededTrace());
  });

  it('writes the three values onto the trace', async () => {
    await handler.execute(describeTrace());

    const trace = await repo.findById('trace-1');
    expect(trace?.origin).toBe('DIGITAL');
    expect(trace?.location).toBe(LOCATION);
    expect(trace?.revelationTechnique).toBe('FINGERPRINT_POWDER');
  });

  it('chains a TRACE_DESCRIBED event carrying the three values', async () => {
    await handler.execute(describeTrace());

    expect(auditTrail.events).toHaveLength(1);
    const [event] = auditTrail.events;
    expect(event.eventType).toBe(AuditEventTypeEnum.TRACE_DESCRIBED);
    expect(event.evidenceClass).toBe(EvidenceClassEnum.DECLARED);
    expect(event.actor).toEqual(EXPERT_ACTOR.toPrimitives());
    expect(event.caseId).toBe('case-1');
    expect(event.traceId).toBe('trace-1');
    expect(event.payload).toEqual({
      origin: 'DIGITAL',
      location: LOCATION,
      revelationTechnique: 'FINGERPRINT_POWDER',
    });
  });

  it('journals the location as it is stored, once trimmed', async () => {
    await handler.execute(describeTrace({ location: `  ${LOCATION}  ` }));

    const [event] = auditTrail.events;
    expect(event.payload).toMatchObject({ location: LOCATION });
  });

  it('chains one event per correction, each carrying the values of its day', async () => {
    await handler.execute(describeTrace());

    await handler.execute(
      describeTrace({
        origin: 'PALMAR',
        location: 'Sur la bouteille de Vodka de marque "POLIAKOV"',
        revelationTechnique: 'DFO',
      }),
    );

    expect(auditTrail.events).toHaveLength(2);
    const [, second] = auditTrail.events;
    expect(second.payload).toEqual({
      origin: 'PALMAR',
      location: 'Sur la bouteille de Vodka de marque "POLIAKOV"',
      revelationTechnique: 'DFO',
    });
  });

  it('still describes a trace already declared exploitable', async () => {
    const trace = seededTrace();
    trace.declareExploitability(true);
    repo.seed(trace);

    await handler.execute(describeTrace());

    expect((await repo.findById('trace-1'))?.location).toBe(LOCATION);
    expect(auditTrail.events).toHaveLength(1);
  });

  it('rejects an unknown trace and chains nothing', async () => {
    await expect(
      handler.execute(describeTrace({ id: 'missing' })),
    ).rejects.toBeInstanceOf(TraceNotFoundError);

    expect(auditTrail.events).toHaveLength(0);
  });

  it('refuses an empty location, chains nothing and leaves the fiche untouched', async () => {
    await handler.execute(describeTrace());

    await expect(
      handler.execute(describeTrace({ location: '   ' })),
    ).rejects.toBeInstanceOf(InvalidTraceLocationError);

    expect(auditTrail.events).toHaveLength(1);
    expect((await repo.findById('trace-1'))?.location).toBe(LOCATION);
  });

  it('refuses a location longer than the accepted maximum and chains nothing', async () => {
    await expect(
      handler.execute(
        describeTrace({ location: 'a'.repeat(MAX_TRACE_LOCATION_LENGTH + 1) }),
      ),
    ).rejects.toBeInstanceOf(InvalidTraceLocationError);

    expect(auditTrail.events).toHaveLength(0);
  });

  it('refuses to describe a trace of a closed case and chains nothing', async () => {
    caseStatus.set('case-1', 'CLOSED');

    await expect(handler.execute(describeTrace())).rejects.toBeInstanceOf(
      CaseNotOpenForWorkError,
    );

    expect(auditTrail.events).toHaveLength(0);
    expect((await repo.findById('trace-1'))?.location).toBeNull();
  });

  it('refuses a revelation technique outside the vocabulary and chains nothing', async () => {
    await expect(
      handler.execute(describeTrace({ revelationTechnique: 'CYANOACRYLATE' })),
    ).rejects.toBeInstanceOf(InvalidRevelationTechniqueError);

    expect(auditTrail.events).toHaveLength(0);
  });
});
