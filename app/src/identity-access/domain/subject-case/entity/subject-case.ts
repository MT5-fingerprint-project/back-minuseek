import { SubjectType } from '../value-objects/subject-type.vo';

interface CreateSubjectCaseProps {
  id: string;
  subjectId: string;
  caseId: string;
  type: SubjectType;
}

export interface SubjectCasePrimitives {
  id: string;
  subjectId: string;
  caseId: string;
  type: string;
}

export class SubjectCase {
  private constructor(
    private readonly _id: string,
    private readonly _subjectId: string,
    private readonly _caseId: string,
    private readonly _type: SubjectType,
  ) {}

  static create(props: CreateSubjectCaseProps): SubjectCase {
    if (!props.id) {
      throw new Error('SubjectCase id is required');
    }
    if (!props.subjectId) {
      throw new Error('SubjectCase subjectId is required');
    }
    if (!props.caseId) {
      throw new Error('SubjectCase caseId is required');
    }
    return new SubjectCase(props.id, props.subjectId, props.caseId, props.type);
  }

  static reconstitute(primitives: SubjectCasePrimitives): SubjectCase {
    return new SubjectCase(
      primitives.id,
      primitives.subjectId,
      primitives.caseId,
      SubjectType.from(primitives.type),
    );
  }

  toPrimitives(): SubjectCasePrimitives {
    return {
      id: this._id,
      subjectId: this._subjectId,
      caseId: this._caseId,
      type: this._type.getValue(),
    };
  }

  get id(): string {
    return this._id;
  }

  get subjectId(): string {
    return this._subjectId;
  }

  get caseId(): string {
    return this._caseId;
  }

  get type(): SubjectType {
    return this._type;
  }
}
