import { ReportImageViewModel } from '../report-view-model';

/** Réglages de l'atelier qui changent la géométrie de l'image imprimée. */
export interface ImageGeometry {
  rotationDeg: number;
  mirrored: boolean;
}

/**
 * Réglages de l'atelier qui changent les pixels sans les déplacer. Les valeurs
 * sont déjà ramenées à l'échelle de l'atelier (le curseur divisé par cent), et
 * l'ordre de la liste est celui des calques : deux traitements ne commutent pas.
 */
export type PixelTreatment =
  | { kind: 'BRIGHTNESS'; amount: number }
  | { kind: 'CONTRAST'; amount: number }
  | { kind: 'SATURATION'; amount: number }
  | { kind: 'INVERSION' }
  | { kind: 'CHANNELS'; red: boolean; green: boolean; blue: boolean }
  | { kind: 'LEVELS'; blackPoint: number; whitePoint: number; gamma: number }
  | { kind: 'SHARPENING'; amount: number };

export interface ImageTreatment {
  geometry: ImageGeometry | null;
  pixels: PixelTreatment[];
}

export interface ReportImageEmbedderPort {
  /**
   * Image prête à être embarquée dans le PDF : data-URL et dimensions natives.
   * `resolutionDpi` non nul demande l'échelle 1 — la reproduction porte alors sa
   * taille réelle en millimètres. `null` quand la pièce est illisible, dans un
   * format que le rendu ne sait pas afficher, ou trop grande pour la planche à
   * l'échelle 1 : le rapport ne l'imprime pas plutôt que de la montrer à une
   * échelle qu'il ne peut pas annoncer. `treatment` non nul reproduit la pièce
   * telle que l'opérateur l'a retravaillée dans le comparateur.
   */
  embed(
    storedPath: string,
    resolutionDpi: number | null,
    treatment: ImageTreatment | null,
  ): Promise<ReportImageViewModel | null>;
}

export const REPORT_IMAGE_EMBEDDER = 'ReportImageEmbedder';
