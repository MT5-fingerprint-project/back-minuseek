import { InvalidCaseExpertiseError } from '../errors/invalid-case-expertise.error';
import { InvalidSaisineError } from '../errors/invalid-saisine.error';

export interface CaseExpertiseAssistant {
  name: string;
  task: string;
}

export interface CaseSaisine {
  magistrateName: string | null;
  magistrateTitle: string | null;
  ordinanceDate: Date | null;
  missionObject: string | null;
  sealCount: number | null;
  prorogationDeadline: Date | null;
  prorogationOrdinanceDate: Date | null;
  biologicalPrecautions: boolean;
  assistants: CaseExpertiseAssistant[];
}

export type CaseSaisineChanges = Partial<CaseSaisine>;

export interface CaseExpertisePrimitives extends CaseSaisine {
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

const SAISINE_FIELDS = [
  'magistrateName',
  'magistrateTitle',
  'ordinanceDate',
  'missionObject',
  'sealCount',
  'prorogationDeadline',
  'prorogationOrdinanceDate',
  'biologicalPrecautions',
  'assistants',
] as const;

const EMPTY_SAISINE: CaseSaisine = {
  magistrateName: null,
  magistrateTitle: null,
  ordinanceDate: null,
  missionObject: null,
  sealCount: null,
  prorogationDeadline: null,
  prorogationOrdinanceDate: null,
  biologicalPrecautions: false,
  assistants: [],
};

function requireWritten(value: string, field: string): string {
  if (value.trim().length === 0) {
    throw new InvalidCaseExpertiseError(field);
  }
  return value;
}

function sameValue(left: unknown, right: unknown): boolean {
  if (left instanceof Date && right instanceof Date) {
    return left.getTime() === right.getTime();
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  return left === right;
}

export class CaseExpertise {
  private constructor(
    private readonly _id: string,
    private readonly _caseId: string,
    private readonly _expertUserId: string,
    private readonly _oathStatement: string,
    private readonly _courtReference: string,
    private readonly _swornAt: Date,
    private _saisine: CaseSaisine,
  ) {}

  static declare(props: DeclareCaseExpertiseProps): CaseExpertise {
    return new CaseExpertise(
      props.id,
      props.caseId,
      props.expertUserId,
      requireWritten(props.oathStatement, 'oathStatement'),
      requireWritten(props.courtReference, 'courtReference'),
      new Date(),
      { ...EMPTY_SAISINE },
    );
  }

  static reconstitute(primitives: CaseExpertisePrimitives): CaseExpertise {
    return new CaseExpertise(
      primitives.id,
      primitives.caseId,
      primitives.expertUserId,
      primitives.oathStatement,
      primitives.courtReference,
      primitives.swornAt,
      {
        magistrateName: primitives.magistrateName,
        magistrateTitle: primitives.magistrateTitle,
        ordinanceDate: primitives.ordinanceDate,
        missionObject: primitives.missionObject,
        sealCount: primitives.sealCount,
        prorogationDeadline: primitives.prorogationDeadline,
        prorogationOrdinanceDate: primitives.prorogationOrdinanceDate,
        biologicalPrecautions: primitives.biologicalPrecautions,
        assistants: primitives.assistants.map((assistant) => ({
          ...assistant,
        })),
      },
    );
  }

  completeSaisine(wanted: CaseSaisineChanges): CaseSaisineChanges {
    const merged = { ...this._saisine, ...wanted };
    if (merged.sealCount !== null && merged.sealCount <= 0) {
      throw new InvalidSaisineError('sealCount', 'doit être un entier positif');
    }
    if (
      merged.prorogationOrdinanceDate !== null &&
      merged.ordinanceDate !== null &&
      merged.prorogationOrdinanceDate.getTime() <=
        merged.ordinanceDate.getTime()
    ) {
      throw new InvalidSaisineError(
        'prorogationOrdinanceDate',
        "doit être postérieure à l'ordonnance initiale",
      );
    }

    const changes: CaseSaisineChanges = {};
    for (const field of SAISINE_FIELDS) {
      if (field in wanted && !sameValue(merged[field], this._saisine[field])) {
        Object.assign(changes, { [field]: merged[field] });
      }
    }
    this._saisine = merged;
    return changes;
  }

  get caseId(): string {
    return this._caseId;
  }

  toPrimitives(): CaseExpertisePrimitives {
    return {
      id: this._id,
      caseId: this._caseId,
      expertUserId: this._expertUserId,
      oathStatement: this._oathStatement,
      courtReference: this._courtReference,
      swornAt: this._swornAt,
      ...this._saisine,
      assistants: this._saisine.assistants.map((assistant) => ({
        ...assistant,
      })),
    };
  }
}
