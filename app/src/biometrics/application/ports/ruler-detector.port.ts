export interface DetectRulerInput {
  /** Octets de la photo, en clair : l'appel a lieu avant toute écriture (ADR-0014). */
  image: Buffer;
  mimeType: string;
}

export interface RulerDetection {
  present: boolean;
  confidence: number;
  /** Version du détecteur qui a produit ce verdict ; null si data ne la donne pas. */
  engineVersion: string | null;
}

export interface RulerDetectorPort {
  detect(input: DetectRulerInput): Promise<RulerDetection>;
}

export const RULER_DETECTOR = 'RulerDetector';

/**
 * `enforce` : une trace sans règle est refusée (422 RULER_NOT_DETECTED).
 * `shadow`  : le verdict est seulement journalisé et audité — mode de calibration,
 * tant que le seuil de data n'est pas validé sur photos réelles et que l'override
 * (BIO-39) n'existe pas.
 */
export type RulerDetectionMode = 'enforce' | 'shadow';

export const RULER_DETECTION_MODE = 'RulerDetectionMode';

export function parseRulerDetectionMode(
  value: string | undefined,
): RulerDetectionMode {
  const mode = value ?? 'shadow';
  if (mode !== 'enforce' && mode !== 'shadow') {
    throw new Error(
      `Unknown RULER_DETECTION_MODE "${value}" (expected enforce | shadow)`,
    );
  }
  return mode;
}
