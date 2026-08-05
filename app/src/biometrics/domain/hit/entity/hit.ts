import { assertEnoughMinutiae } from '../hit-rules';

export interface HitPrimitives {
  id: string;
  traceId: string;
  referencePrintId: string;
  declaredByUserId: string | null;
}

interface RecordHitProps {
  id: string;
  traceId: string;
  referencePrintId: string;
  declaredByUserId?: string | null;
  traceMinutiae: number;
  referenceMinutiae: number;
}

export class Hit {
  private constructor(
    private readonly _id: string,
    private readonly _traceId: string,
    private readonly _referencePrintId: string,
    private readonly _declaredByUserId: string | null,
  ) {}

  static record(props: RecordHitProps): Hit {
    assertEnoughMinutiae(props.traceMinutiae, props.referenceMinutiae);
    return new Hit(
      props.id,
      props.traceId,
      props.referencePrintId,
      props.declaredByUserId ?? null,
    );
  }

  static fromPrimitives(props: HitPrimitives): Hit {
    return new Hit(
      props.id,
      props.traceId,
      props.referencePrintId,
      props.declaredByUserId,
    );
  }

  toPrimitives(): HitPrimitives {
    return {
      id: this._id,
      traceId: this._traceId,
      referencePrintId: this._referencePrintId,
      declaredByUserId: this._declaredByUserId,
    };
  }

  get id(): string {
    return this._id;
  }
  get traceId(): string {
    return this._traceId;
  }
  get referencePrintId(): string {
    return this._referencePrintId;
  }
  get declaredByUserId(): string | null {
    return this._declaredByUserId;
  }
}
