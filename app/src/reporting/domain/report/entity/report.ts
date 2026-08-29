import { AuditActorPrimitives } from '../../../../shared/domain/audit/audit-actor.vo';
import { InvalidReportError } from '../errors/invalid-report.error';

export type ReportTypeName = 'TECHNICAL' | 'TRACEABILITY';

const SHA256_HEX = /^[0-9a-f]{64}$/;

export interface ReportPrimitives {
  id: string;
  caseId: string;
  type: ReportTypeName;
  sequence: number;
  number: string;
  signerUserId: string;
  storagePath: string;
  sha256: string;
  generatedBy: AuditActorPrimitives;
  createdAt: Date;
}

type SealReportProps = ReportPrimitives;

/**
 * Un rapport est un aggregate persisté, pas un fichier jetable : il se reliste,
 * se re-télécharge, et son sha256 est ce que le magistrat confronte au PDF qu'il
 * a en main.
 */
export class Report {
  private constructor(
    private readonly _id: string,
    private readonly _caseId: string,
    private readonly _type: ReportTypeName,
    private readonly _sequence: number,
    private readonly _number: string,
    private readonly _signerUserId: string,
    private readonly _storagePath: string,
    private readonly _sha256: string,
    private readonly _generatedBy: AuditActorPrimitives,
    private readonly _createdAt: Date,
  ) {}

  static seal(props: SealReportProps): Report {
    if (!SHA256_HEX.test(props.sha256)) {
      throw new InvalidReportError(
        '"sha256" doit être un SHA-256 hexadécimal minuscule de 64 caractères',
      );
    }
    if (props.storagePath.trim().length === 0) {
      throw new InvalidReportError('"storagePath" ne peut pas être vide');
    }
    if (!Number.isInteger(props.sequence) || props.sequence < 1) {
      throw new InvalidReportError(
        '"sequence" doit être un entier supérieur ou égal à 1',
      );
    }
    if (props.number.trim().length === 0) {
      throw new InvalidReportError('"number" ne peut pas être vide');
    }
    if (props.signerUserId.trim().length === 0) {
      throw new InvalidReportError('"signerUserId" ne peut pas être vide');
    }
    return new Report(
      props.id,
      props.caseId,
      props.type,
      props.sequence,
      props.number,
      props.signerUserId,
      props.storagePath,
      props.sha256,
      props.generatedBy,
      props.createdAt,
    );
  }

  static reconstitute(primitives: ReportPrimitives): Report {
    return Report.seal(primitives);
  }

  get id(): string {
    return this._id;
  }

  get caseId(): string {
    return this._caseId;
  }

  get sequence(): number {
    return this._sequence;
  }

  get number(): string {
    return this._number;
  }

  get storagePath(): string {
    return this._storagePath;
  }

  get sha256(): string {
    return this._sha256;
  }

  toPrimitives(): ReportPrimitives {
    return {
      id: this._id,
      caseId: this._caseId,
      type: this._type,
      sequence: this._sequence,
      number: this._number,
      signerUserId: this._signerUserId,
      storagePath: this._storagePath,
      sha256: this._sha256,
      generatedBy: this._generatedBy,
      createdAt: this._createdAt,
    };
  }
}
