import { InvalidCaseExpertiseError } from '../errors/invalid-case-expertise.error';

export interface CaseExpertisePrimitives {
  id: string;
  caseId: string;
  expertUserId: string;
  oathStatement: string;
  courtReference: string;
  swornAt: Date;
}

interface DeclareCaseExpertiseProps {
  id: string;
  caseId: string;
  expertUserId: string;
  oathStatement: string;
  courtReference: string;
}

function requireWritten(value: string, field: string): string {
  if (value.trim().length === 0) {
    throw new InvalidCaseExpertiseError(field);
  }
  return value;
}

export class CaseExpertise {
  private constructor(
    private readonly _id: string,
    private readonly _caseId: string,
    private readonly _expertUserId: string,
    private readonly _oathStatement: string,
    private readonly _courtReference: string,
    private readonly _swornAt: Date,
  ) {}

  static declare(props: DeclareCaseExpertiseProps): CaseExpertise {
    return new CaseExpertise(
      props.id,
      props.caseId,
      props.expertUserId,
      requireWritten(props.oathStatement, 'oathStatement'),
      requireWritten(props.courtReference, 'courtReference'),
      new Date(),
    );
  }

  toPrimitives(): CaseExpertisePrimitives {
    return {
      id: this._id,
      caseId: this._caseId,
      expertUserId: this._expertUserId,
      oathStatement: this._oathStatement,
      courtReference: this._courtReference,
      swornAt: this._swornAt,
    };
  }
}
