import { AuditEventData } from '../../ports/traceability-data.reader';
import {
  ReportJournalEntryViewModel,
  ReportJournalViewModel,
} from '../../report-view-model';
import { actionLabel, describeAction } from './action-labels';

function toChainedEntry(event: AuditEventData): ReportJournalEntryViewModel {
  return {
    label: actionLabel(event.eventType),
    detail: describeAction(event.eventType, event.payload),
    occurredAt: event.occurredAt,
    actorDisplayName: event.actorDisplayName,
    seq: event.seq,
    hash: event.hash,
  };
}

export function buildJournal(
  chainEvents: AuditEventData[],
): ReportJournalViewModel {
  return {
    chained: [...chainEvents]
      .sort((left, right) => left.seq - right.seq)
      .map(toChainedEntry),
  };
}
