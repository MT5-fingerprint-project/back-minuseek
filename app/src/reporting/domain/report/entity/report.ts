import { AuditActorPrimitives } from '../../../../shared/domain/audit/audit-actor.vo';
import { InvalidReportError } from '../errors/invalid-report.error';

export type ReportTypeName = 'TECHNICAL' | 'TRACEABILITY';

const SHA256_HEX = /^[0-9a-f]{64}$/;

export interface ReportPrimitives {
  id: string;
  caseId: string;
  type: ReportTypeName;
  storagePath: string;
  sha256: string;
  generatedBy: AuditActorPrimitives;
  createdAt: Date;
}

interface SealReportProps {
  id: string;
  caseId: string;
  type: ReportTypeName;
  storagePath: string;
  sha256: string;
  generatedBy: AuditActorPrimitives;
  createdAt: Date;
}

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
    return new Report(
      props.id,
      props.caseId,
      props.type,
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
      storagePath: this._storagePath,
      sha256: this._sha256,
      generatedBy: this._generatedBy,
      createdAt: this._createdAt,
    };
  }
}
