import type {
  CaseAccessGrant,
  CaseAccessReader,
  CaseResourceKind,
} from '../../application/case-access.reader';

export interface CaseAccessFixture {
  operators?: { caseId: string; userId: string }[];
  verifications?: { caseId: string; userId: string; inProgress: boolean }[];
  traces?: { id: string; caseId: string }[];
  referencePrints?: { id: string; caseId: string }[];
  layers?: { id: string; fingerprintId: string }[];
  subjects?: { id: string; caseId: string }[];
  reports?: { id: string; caseId: string }[];
}

export class InMemoryCaseAccessReader implements CaseAccessReader {
  private readonly fixture: Required<CaseAccessFixture>;

  constructor(fixture: CaseAccessFixture = {}) {
    this.fixture = {
      operators: fixture.operators ?? [],
      verifications: fixture.verifications ?? [],
      traces: fixture.traces ?? [],
      referencePrints: fixture.referencePrints ?? [],
      layers: fixture.layers ?? [],
      subjects: fixture.subjects ?? [],
      reports: fixture.reports ?? [],
    };
  }

  findGrant(userId: string, caseId: string): Promise<CaseAccessGrant | null> {
    const isOperator = this.fixture.operators.some(
      (operator) => operator.userId === userId && operator.caseId === caseId,
    );
    if (isOperator) {
      return Promise.resolve({
        title: 'CASE_OPERATOR',
        verificationInProgress: false,
      });
    }

    const missions = this.fixture.verifications.filter(
      (verification) =>
        verification.userId === userId && verification.caseId === caseId,
    );
    if (missions.length === 0) {
      return Promise.resolve(null);
    }
    return Promise.resolve({
      title: 'CASE_VERIFIER',
      verificationInProgress: missions.some(
        (verification) => verification.inProgress,
      ),
    });
  }

  findCaseIdsOf(userId: string): Promise<string[]> {
    const ownCaseIds = this.fixture.operators
      .filter((operator) => operator.userId === userId)
      .map((operator) => operator.caseId);
    const verifiedCaseIds = this.fixture.verifications
      .filter((verification) => verification.userId === userId)
      .map((verification) => verification.caseId);

    return Promise.resolve([...new Set([...ownCaseIds, ...verifiedCaseIds])]);
  }

  findCaseIdOfResource(
    kind: CaseResourceKind,
    resourceId: string,
  ): Promise<string | null> {
    switch (kind) {
      case 'TRACE':
        return Promise.resolve(this.caseIdOfTrace(resourceId));
      case 'REFERENCE_PRINT':
        return Promise.resolve(this.caseIdOfReferencePrint(resourceId));
      case 'IMAGE':
        return Promise.resolve(this.caseIdOfImage(resourceId));
      case 'LAYER': {
        const layer = this.fixture.layers.find(
          (candidate) => candidate.id === resourceId,
        );
        return Promise.resolve(
          layer ? this.caseIdOfImage(layer.fingerprintId) : null,
        );
      }
      case 'SUBJECT': {
        const subject = this.fixture.subjects.find(
          (candidate) => candidate.id === resourceId,
        );
        return Promise.resolve(subject?.caseId ?? null);
      }
      case 'REPORT': {
        const report = this.fixture.reports.find(
          (candidate) => candidate.id === resourceId,
        );
        return Promise.resolve(report?.caseId ?? null);
      }
    }
  }

  private caseIdOfImage(fingerprintId: string): string | null {
    return (
      this.caseIdOfTrace(fingerprintId) ??
      this.caseIdOfReferencePrint(fingerprintId)
    );
  }

  private caseIdOfTrace(traceId: string): string | null {
    return (
      this.fixture.traces.find((trace) => trace.id === traceId)?.caseId ?? null
    );
  }

  private caseIdOfReferencePrint(referencePrintId: string): string | null {
    return (
      this.fixture.referencePrints.find(
        (referencePrint) => referencePrint.id === referencePrintId,
      )?.caseId ?? null
    );
  }
}
