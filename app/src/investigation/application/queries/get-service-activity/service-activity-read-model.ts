export interface ServiceOperatorReadModel {
  id: string;
  firstName: string;
  lastName: string;
}

export interface OpenCaseReadModel {
  id: string;
  caseNumber: string;
  openedAt: Date;
  ageInDays: number;
  operator: ServiceOperatorReadModel | null;
  lastActivityAt: Date | null;
}

export interface MonthlyCaseFlowReadModel {
  month: string;
  opened: number;
  closed: number;
}

export interface OperatorCaseloadReadModel {
  operator: ServiceOperatorReadModel | null;
  openCases: number;
  closedInPeriod: number;
  medianClosureDays: number | null;
}

export interface ServiceActivityReadModel {
  period: { from: Date; to: Date };
  cases: {
    open: number;
    openOver90Days: number;
    openedInPeriod: number;
    closedInPeriod: number;
    medianClosureDays: number | null;
    ninthDecileClosureDays: number | null;
    monthlyFlow: MonthlyCaseFlowReadModel[];
    openCases: OpenCaseReadModel[];
  };
  traces: {
    collected: number;
    exploitable: number;
    compared: number;
    identified: number;
  };
  signals: {
    dormantOver30Days: number;
    expertiseDeadlinesUnder15Days: number;
    exploitableNeverCompared: number;
    openWithoutOperator: number;
  };
  byOperator: OperatorCaseloadReadModel[];
}
