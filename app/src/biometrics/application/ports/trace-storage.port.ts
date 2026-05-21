export interface TraceStoragePort {
  save(buffer: Buffer, fileName: string): Promise<string>;
}
