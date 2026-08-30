import { DecisionOutcomeEnum } from '../value-objects/decision-outcome.vo';
import {
  VerificationStatus,
  VerificationStatusEnum,
} from '../value-objects/verification-status.vo';

export interface RequestCaseVerificationProps {
  id: string;
  caseId: string;
  verifierUserId: string;
  requestedByUserId: string;
}

export interface CaseVerificationPrimitives {
  id: string;
  caseId: string;
  verifierUserId: string;
  requestedByUserId: string;
  status: string;
  requestedAt: Date;
  completedAt: Date | null;
}

export class CaseVerification {
  private constructor(
    private readonly _id: string,
    private readonly _caseId: string,
    private readonly _verifierUserId: string,
    private readonly _requestedByUserId: string,
    private _status: VerificationStatus,
    private readonly _requestedAt: Date,
    private _completedAt: Date | null,
  ) {}

  static request(props: RequestCaseVerificationProps): CaseVerification {
    return new CaseVerification(
      props.id,
      props.caseId,
      props.verifierUserId,
      props.requestedByUserId,
      VerificationStatus.pending(),
      new Date(),
      null,
    );
  }

  static reconstitute(
    primitives: CaseVerificationPrimitives,
  ): CaseVerification {
    return new CaseVerification(
      primitives.id,
      primitives.caseId,
      primitives.verifierUserId,
      primitives.requestedByUserId,
      VerificationStatus.from(primitives.status),
      primitives.requestedAt,
      primitives.completedAt,
    );
  }

  complete(outcome: DecisionOutcomeEnum): void {
    this._status = VerificationStatus.from(outcome);
    this._completedAt = new Date();
  }

  toPrimitives(): CaseVerificationPrimitives {
    return {
      id: this._id,
      caseId: this._caseId,
      verifierUserId: this._verifierUserId,
      requestedByUserId: this._requestedByUserId,
      status: this._status.getValue(),
      requestedAt: this.requestedAt,
      completedAt: this.completedAt,
    };
  }

  get id(): string {
    return this._id;
  }

  get caseId(): string {
    return this._caseId;
  }

  get verifierUserId(): string {
    return this._verifierUserId;
  }

  get requestedByUserId(): string {
    return this._requestedByUserId;
  }

  get status(): VerificationStatusEnum {
    return this._status.getValue();
  }

  get requestedAt(): Date {
    return new Date(this._requestedAt);
  }

  get completedAt(): Date | null {
    return this._completedAt === null ? null : new Date(this._completedAt);
  }
}
