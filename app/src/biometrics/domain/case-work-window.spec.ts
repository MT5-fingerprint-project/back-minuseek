import { assertCaseAcceptsWork } from './case-work-window';
import { CaseNotOpenForWorkError } from './errors/case-not-open-for-work.error';
import { CaseUnavailableForTraceError } from './trace/errors/case-unavailable-for-trace.error';

describe('assertCaseAcceptsWork', () => {
  it.each(['OPEN', 'IN_PROGRESS', 'UNDER_REVIEW'])(
    'laisse travailler sur une affaire %s',
    (status) => {
      expect(() => assertCaseAcceptsWork('case-1', status)).not.toThrow();
    },
  );

  it('refuse une affaire close', () => {
    expect(() => assertCaseAcceptsWork('case-1', 'CLOSED')).toThrow(
      CaseNotOpenForWorkError,
    );
  });

  it("répond « affaire indisponible » quand l'affaire est introuvable", () => {
    expect(() => assertCaseAcceptsWork('case-1', null)).toThrow(
      CaseUnavailableForTraceError,
    );
  });
});
