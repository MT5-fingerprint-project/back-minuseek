import { InvalidConcordanceVideoError } from '../errors/invalid-concordance-video.error';

const SHA256_HEX = /^[0-9a-f]{64}$/;

export interface ConcordanceVideoPrimitives {
  id: string;
  caseId: string;
  traceId: string;
  referencePrintId: string;
  path: string;
  sha256: string;
  createdAt: Date;
}

type SealConcordanceVideoProps = ConcordanceVideoPrimitives;

/**
 * La démonstration animée des concordances entre une trace et une empreinte de
 * référence, telle qu'elle a été jouée à l'écran. Elle porte les deux pièces et
 * non une seule : c'est ce qui permet de remonter de la vidéo à l'empreinte
 * qu'elle montre. Scellée dès sa création — il n'existe pas de vidéo non scellée.
 */
export class ConcordanceVideo {
  private constructor(
    private readonly _id: string,
    private readonly _caseId: string,
    private readonly _traceId: string,
    private readonly _referencePrintId: string,
    private readonly _path: string,
    private readonly _sha256: string,
    private readonly _createdAt: Date,
  ) {}

  static seal(props: SealConcordanceVideoProps): ConcordanceVideo {
    if (!SHA256_HEX.test(props.sha256)) {
      throw new InvalidConcordanceVideoError(
        '"sha256" doit être un SHA-256 hexadécimal minuscule de 64 caractères',
      );
    }
    if (props.path.trim().length === 0) {
      throw new InvalidConcordanceVideoError('"path" ne peut pas être vide');
    }
    if (props.traceId.trim().length === 0) {
      throw new InvalidConcordanceVideoError('"traceId" ne peut pas être vide');
    }
    if (props.referencePrintId.trim().length === 0) {
      throw new InvalidConcordanceVideoError(
        '"referencePrintId" ne peut pas être vide',
      );
    }
    return new ConcordanceVideo(
      props.id,
      props.caseId,
      props.traceId,
      props.referencePrintId,
      props.path,
      props.sha256,
      props.createdAt,
    );
  }

  static reconstitute(
    primitives: ConcordanceVideoPrimitives,
  ): ConcordanceVideo {
    return ConcordanceVideo.seal(primitives);
  }

  get id(): string {
    return this._id;
  }

  get caseId(): string {
    return this._caseId;
  }

  get traceId(): string {
    return this._traceId;
  }

  get referencePrintId(): string {
    return this._referencePrintId;
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

  toPrimitives(): ConcordanceVideoPrimitives {
    return {
      id: this._id,
      caseId: this._caseId,
      traceId: this._traceId,
      referencePrintId: this._referencePrintId,
      path: this._path,
      sha256: this._sha256,
      createdAt: this._createdAt,
    };
  }
}
