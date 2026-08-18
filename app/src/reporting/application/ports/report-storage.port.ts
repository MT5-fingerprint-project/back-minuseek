export interface ReportStoragePort {
  save(pdf: Buffer, relativePath: string): Promise<string>;
  getUrl(storedPath: string): Promise<string>;
  /** Octets d'une pièce, pour l'embarquer dans le PDF sans dépendre du réseau au rendu. */
  read(storedPath: string): Promise<Buffer>;
}

export const REPORT_STORAGE = 'ReportStorage';
