export interface ReportStoragePort {
  save(pdf: Buffer, relativePath: string): Promise<string>;
  getUrl(storedPath: string): Promise<string>;
}

export const REPORT_STORAGE = 'ReportStorage';
