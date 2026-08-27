import {
  InvestigationCaseStatus,
  InvestigationCaseStatusEnum,
} from '../value-objects/investigation-case-status.vo';
import { CaseClosedError } from '../errors/case-closed.error';

interface OpenInvestigationCaseProps {
  id: string;
  caseNumber: string;
  pvNumber: string;
  description?: string;
  operatorUserId: string;
}

export interface CaseCorrection {
  pvNumber?: string;
  description?: string | null;
}

export interface InvestigationCasePrimitives {
  id: string;
  caseNumber: string;
  pvNumber: string;
  description: string | null;
  status: string;
  operatorUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class InvestigationCase {
  private constructor(
    private readonly _id: string,
    private readonly _caseNumber: string,
    private _pvNumber: string,
    private _description: string | undefined,
    private _status: InvestigationCaseStatus,
    private _operatorUserId: string | null,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {}

  static open(props: OpenInvestigationCaseProps): InvestigationCase {
    const now = new Date();
    return new InvestigationCase(
      props.id,
      props.caseNumber,
      props.pvNumber,
      props.description,
      InvestigationCaseStatus.open(),
      props.operatorUserId,
      now,
      now,
    );
  }

  static reconstitute(
    primitives: InvestigationCasePrimitives,
  ): InvestigationCase {
    return new InvestigationCase(
      primitives.id,
      primitives.caseNumber,
      primitives.pvNumber,
      primitives.description ?? undefined,
      InvestigationCaseStatus.from(primitives.status),
      primitives.operatorUserId,
      primitives.createdAt,
      primitives.updatedAt,
    );
  }

  correct(correction: CaseCorrection): void {
    if (this.status === InvestigationCaseStatusEnum.CLOSED) {
      throw new CaseClosedError(this._id);
    }
    if (correction.pvNumber !== undefined) {
      this._pvNumber = correction.pvNumber;
    }
    if (correction.description !== undefined) {
      this._description = correction.description ?? undefined;
    }
    this._updatedAt = new Date();
  }

  changeOperator(newOperatorUserId: string): void {
    if (this.status === InvestigationCaseStatusEnum.CLOSED) {
      throw new CaseClosedError(this._id);
    }
    this._operatorUserId = newOperatorUserId;
    this._updatedAt = new Date();
  }

  get id() {
    return this._id;
  }

  get caseNumber() {
    return this._caseNumber;
  }

  get pvNumber() {
    return this._pvNumber;
  }

  get description() {
    return this._description;
  }

  get status() {
    return this._status.getValue();
  }

  get operatorUserId() {
    return this._operatorUserId;
  }

  get createdAt() {
    return this._createdAt;
  }

  get updatedAt() {
    return this._updatedAt;
  }
}
