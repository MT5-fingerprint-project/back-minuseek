import { InvalidCaptureQualityError } from '../errors/invalid-capture-quality.error';

// Contrôle de netteté relevé par le mobile au déclenchement (B2). `blurScore`
// est la variance du Laplacien de l'aperçu : plus il est haut, plus l'image est
// nette. `passed` est le verdict rendu on-device au seuil embarqué du moment —
// on le conserve tel quel, il documente ce que l'opérateur a vu à la capture.
export interface CaptureQualityProps {
  blurScore: number;
  passed: boolean;
}

export class CaptureQuality {
  private constructor(
    private readonly _blurScore: number,
    private readonly _passed: boolean,
  ) {}

  static of(props: CaptureQualityProps): CaptureQuality {
    assertBlurScore(props.blurScore);
    assertVerdict(props.passed);
    return new CaptureQuality(props.blurScore, props.passed);
  }

  // La colonne est un `Json?` : Prisma rend une valeur non typée, dont on ne
  // garde que les deux clés du contrat (une valeur écrite par un producteur
  // plus ancien peut en porter d'autres).
  static fromPersistence(stored: unknown): CaptureQuality | null {
    if (stored === null || stored === undefined) return null;
    if (typeof stored !== 'object' || Array.isArray(stored)) {
      throw new InvalidCaptureQualityError(
        `la colonne doit contenir un objet { blurScore, passed } (reçu : ${JSON.stringify(stored)})`,
      );
    }
    const { blurScore, passed } = stored as Partial<CaptureQualityProps>;
    return CaptureQuality.of({
      blurScore: blurScore as number,
      passed: passed as boolean,
    });
  }

  get blurScore(): number {
    return this._blurScore;
  }

  get passed(): boolean {
    return this._passed;
  }

  toPrimitives(): CaptureQualityProps {
    return { blurScore: this._blurScore, passed: this._passed };
  }
}

function assertBlurScore(value: number): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new InvalidCaptureQualityError(
      `blurScore doit être un nombre fini supérieur ou égal à 0 (reçu : ${String(value)})`,
    );
  }
}

function assertVerdict(value: boolean): void {
  if (typeof value !== 'boolean') {
    throw new InvalidCaptureQualityError(
      `passed doit être un booléen (reçu : ${String(value)})`,
    );
  }
}
