import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { AuditEventData } from '../../ports/traceability-data.reader';
import {
  JournalDetail,
  ReportJournalActViewModel,
  ReportJournalSummaryViewModel,
  ReportJournalViewModel,
} from '../../report-view-model';
import { Designations, journalSentence } from './journal-sentences';
import { designationOf } from './piece-designations';

const ADMINISTRATIVE_EVENT_TYPES = new Set<string>([
  AuditEventTypeEnum.CASE_UPDATED,
  AuditEventTypeEnum.CASE_SAISINE_UPDATED,
  AuditEventTypeEnum.SERVICE_HEADER_SAVED,
]);

export const PRINTABLE_EVENT_TYPES = new Set<string>(
  Object.values(AuditEventTypeEnum).filter(
    (eventType) => !ADMINISTRATIVE_EVENT_TYPES.has(eventType),
  ),
);

const LAYER_EVENT_TYPES = new Set<string>([
  AuditEventTypeEnum.LAYER_CREATED,
  AuditEventTypeEnum.LAYER_UPDATED,
  AuditEventTypeEnum.LAYER_DELETED,
]);

export const SUMMARISABLE_FILTER_TYPES = LAYER_EVENT_TYPES;
export const SUMMARISABLE_MARK_TYPES = LAYER_EVENT_TYPES;

type SummaryFamily = ReportJournalSummaryViewModel['family'];

function summarisableFamily(event: AuditEventData): SummaryFamily | null {
  if (!LAYER_EVENT_TYPES.has(event.eventType)) {
    return null;
  }
  if (event.payload.type === 'FILTER') {
    return 'ADJUSTMENT';
  }
  return event.payload.type === 'ANNOTATION' ? 'MARK' : null;
}

export function buildJournalAnnex(
  events: AuditEventData[],
  named: Designations,
  detail: JournalDetail,
): ReportJournalViewModel {
  const chronology = [...events].sort((left, right) => left.seq - right.seq);
  const printable = chronology.filter((event) =>
    PRINTABLE_EVENT_TYPES.has(event.eventType),
  );

  const acts: ReportJournalActViewModel[] = [];
  const summaries = new Map<string, ReportJournalSummaryViewModel>();

  for (const event of printable) {
    const family = detail === 'SUMMARY' ? summarisableFamily(event) : null;
    if (family === null) {
      acts.push({
        order: acts.length + 1,
        occurredAt: event.occurredAt,
        actorDisplayName: event.actorDisplayName,
        sentence: journalSentence(event, named),
      });
      continue;
    }

    const pieceDesignation = designationOf(
      named,
      event.payload.fingerprintId,
    ).full;
    const key = `${family}:${pieceDesignation}`;
    const known = summaries.get(key);
    if (known) {
      known.count += 1;
      known.lastAt = event.occurredAt;
      continue;
    }
    summaries.set(key, {
      family,
      pieceDesignation,
      count: 1,
      firstAt: event.occurredAt,
      lastAt: event.occurredAt,
    });
  }

  return {
    detail,
    acts,
    summaries: [...summaries.values()],
    actCountTotal: chronology.length,
    actCountPrinted: acts.length + summaries.size,
  };
}

export type JournalRow =
  | { kind: 'act'; at: Date; act: ReportJournalActViewModel }
  | { kind: 'summary'; at: Date; summary: ReportJournalSummaryViewModel };

export function journalRows(journal: ReportJournalViewModel): JournalRow[] {
  const rows: JournalRow[] = [
    ...journal.acts.map(
      (act): JournalRow => ({ kind: 'act', at: act.occurredAt, act }),
    ),
    ...journal.summaries.map(
      (summary): JournalRow => ({
        kind: 'summary',
        at: summary.lastAt,
        summary,
      }),
    ),
  ];
  return rows.sort((left, right) => left.at.getTime() - right.at.getTime());
}
