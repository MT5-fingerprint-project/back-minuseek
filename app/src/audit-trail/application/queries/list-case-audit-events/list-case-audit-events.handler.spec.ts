import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import {
  InMemoryCaseAuditEventReader,
  StoredCaseAuditEvent,
} from '../../../infrastructure/persistence/in-memory-case-audit-event.reader';
import { ListCaseAuditEventsHandler } from './list-case-audit-events.handler';
import { ListCaseAuditEventsQuery } from './list-case-audit-events.query';

const CASE_ID = 'case-1';

const makeEvent = (
  overrides: Partial<StoredCaseAuditEvent> = {},
): StoredCaseAuditEvent => ({
  caseId: CASE_ID,
  seq: 1,
  eventType: AuditEventTypeEnum.CASE_OPENED,
  evidenceClass: EvidenceClassEnum.OBSERVED,
  actor: { displayName: 'Alex Martin', username: 'amartin' },
  occurredAt: new Date('2026-08-18T10:00:00.000Z'),
  payload: { caseNumber: 'AFF-001' },
  ...overrides,
});

describe('ListCaseAuditEventsHandler', () => {
  let handler: ListCaseAuditEventsHandler;
  let reader: InMemoryCaseAuditEventReader;

  beforeEach(() => {
    reader = new InMemoryCaseAuditEventReader();
    handler = new ListCaseAuditEventsHandler(reader);
  });

  it("retourne une chronologie vide quand le dossier n'a aucun événement", async () => {
    const result = await handler.execute(new ListCaseAuditEventsQuery(CASE_ID));

    expect(result.data).toHaveLength(0);
    expect(result.meta.itemCount).toBe(0);
    expect(result.meta.hasNextPage).toBe(false);
  });

  it('expose le maillon sans ses hashes', async () => {
    reader.store.push(makeEvent());

    const result = await handler.execute(new ListCaseAuditEventsQuery(CASE_ID));

    expect(result.data[0]).toEqual({
      seq: 1,
      eventType: AuditEventTypeEnum.CASE_OPENED,
      evidenceClass: EvidenceClassEnum.OBSERVED,
      actor: { displayName: 'Alex Martin', username: 'amartin' },
      occurredAt: new Date('2026-08-18T10:00:00.000Z'),
      payload: { caseNumber: 'AFF-001' },
    });
  });

  it('ignore les événements des autres dossiers', async () => {
    reader.store.push(makeEvent({ seq: 1 }));
    reader.store.push(makeEvent({ seq: 2, caseId: 'case-2' }));

    const result = await handler.execute(new ListCaseAuditEventsQuery(CASE_ID));

    expect(result.data).toHaveLength(1);
    expect(result.data[0].seq).toBe(1);
  });

  it('trie du maillon le plus récent au plus ancien', async () => {
    reader.store.push(makeEvent({ seq: 1 }));
    reader.store.push(makeEvent({ seq: 3 }));
    reader.store.push(makeEvent({ seq: 2 }));

    const result = await handler.execute(new ListCaseAuditEventsQuery(CASE_ID));

    expect(result.data.map((event) => event.seq)).toEqual([3, 2, 1]);
  });

  it("filtre par type d'événement", async () => {
    reader.store.push(makeEvent({ seq: 1 }));
    reader.store.push(
      makeEvent({ seq: 2, eventType: AuditEventTypeEnum.LAYER_CREATED }),
    );

    const result = await handler.execute(
      new ListCaseAuditEventsQuery(CASE_ID, AuditEventTypeEnum.LAYER_CREATED),
    );

    expect(result.data).toHaveLength(1);
    expect(result.data[0].seq).toBe(2);
    expect(result.meta.itemCount).toBe(1);
  });

  it('pagine et calcule la meta', async () => {
    for (let seq = 1; seq <= 5; seq++) {
      reader.store.push(makeEvent({ seq }));
    }

    const result = await handler.execute(
      new ListCaseAuditEventsQuery(CASE_ID, undefined, 2, 2),
    );

    expect(result.data.map((event) => event.seq)).toEqual([3, 2]);
    expect(result.meta.pageCount).toBe(3);
    expect(result.meta.hasPreviousPage).toBe(true);
    expect(result.meta.hasNextPage).toBe(true);
  });
});
