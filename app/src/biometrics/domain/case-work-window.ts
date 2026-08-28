import { CaseUnavailableForTraceError } from './trace/errors/case-unavailable-for-trace.error';
import { CaseNotOpenForWorkError } from './errors/case-not-open-for-work.error';

export function assertCaseAcceptsWork(
  caseId: string,
  caseStatus: string | null,
): void {
  if (caseStatus === null) {
    throw new CaseUnavailableForTraceError(caseId);
  }
  if (caseStatus === 'CLOSED') {
    throw new CaseNotOpenForWorkError(caseId);
  }
}
