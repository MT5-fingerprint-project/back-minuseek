import { InvalidExportedImageError } from '../errors/invalid-exported-image.error';

export type ExportedImageSourceKind = 'TRACE' | 'REFERENCE_PRINT';

const SHA256_HEX = /^[0-9a-f]{64}$/;

export interface ExportedImagePrimitives {
  id: string;
  caseId: string;
  sourcePieceId: string;
  sourceKind: ExportedImageSourceKind;
  path: string;
  sha256: string;
  createdAt: Date;
}

type SealExportedImageProps = ExportedImagePrimitives;

/**
 * Le rendu d'une trace ou d'une empreinte de référence tel qu'affiché à
 * l'écran (réglages et annotations visibles compris) : une pièce dérivée du
 * dossier, scellée dès sa création — il n'existe pas d'export non scellé.
 */
export class ExportedImage {
  private constructor(
    private readonly _id: string,
    private readonly _caseId: string,
    private readonly _sourcePieceId: string,
    private readonly _sourceKind: ExportedImageSourceKind,
    private readonly _path: string,
    private readonly _sha256: string,
    private readonly _createdAt: Date,
  ) {}

  static seal(props: SealExportedImageProps): ExportedImage {
    if (!SHA256_HEX.test(props.sha256)) {
      throw new InvalidExportedImageError(
        '"sha256" doit être un SHA-256 hexadécimal minuscule de 64 caractères',
      );
    }
    if (props.path.trim().length === 0) {
      throw new InvalidExportedImageError('"path" ne peut pas être vide');
    }
    if (props.sourcePieceId.trim().length === 0) {
      throw new InvalidExportedImageError(
        '"sourcePieceId" ne peut pas être vide',
      );
    }
    return new ExportedImage(
      props.id,
      props.caseId,
      props.sourcePieceId,
      props.sourceKind,
      props.path,
      props.sha256,
      props.createdAt,
    );
  }

  static reconstitute(primitives: ExportedImagePrimitives): ExportedImage {
    return ExportedImage.seal(primitives);
  }

  get id(): string {
    return this._id;
  }

  get caseId(): string {
    return this._caseId;
  }

  get sourcePieceId(): string {
    return this._sourcePieceId;
  }

  get path(): string {
    return this._path;
  }

  get sha256(): string {
    return this._sha256;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  toPrimitives(): ExportedImagePrimitives {
    return {
      id: this._id,
      caseId: this._caseId,
      sourcePieceId: this._sourcePieceId,
      sourceKind: this._sourceKind,
      path: this._path,
      sha256: this._sha256,
      createdAt: this._createdAt,
    };
  }
}
