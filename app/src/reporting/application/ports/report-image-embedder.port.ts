import { ReportImageViewModel } from '../report-view-model';

export interface ReportImageEmbedderPort {
  /**
   * Image prête à être embarquée dans le PDF : data-URL et dimensions natives.
   * `null` quand la pièce est illisible ou dans un format que le rendu ne sait
   * pas afficher — le rapport le signale plutôt que d'échouer.
   */
  embed(storedPath: string): Promise<ReportImageViewModel | null>;
}

export const REPORT_IMAGE_EMBEDDER = 'ReportImageEmbedder';
