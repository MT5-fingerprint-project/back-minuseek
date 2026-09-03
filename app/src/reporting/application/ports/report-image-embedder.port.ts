import { ReportImageViewModel } from '../report-view-model';

export interface ReportImageEmbedderPort {
  /**
   * Image prête à être embarquée dans le PDF : data-URL et dimensions natives.
   * `resolutionDpi` non nul demande l'échelle 1 — la reproduction porte alors sa
   * taille réelle en millimètres. `null` quand la pièce est illisible, dans un
   * format que le rendu ne sait pas afficher, ou trop grande pour la planche à
   * l'échelle 1 : le rapport ne l'imprime pas plutôt que de la montrer à une
   * échelle qu'il ne peut pas annoncer.
   */
  embed(
    storedPath: string,
    resolutionDpi: number | null,
  ): Promise<ReportImageViewModel | null>;
}

export const REPORT_IMAGE_EMBEDDER = 'ReportImageEmbedder';
