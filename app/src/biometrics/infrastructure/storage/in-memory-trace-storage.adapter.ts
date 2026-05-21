import { TraceStoragePort } from '../../application/ports/trace-storage.port';

export class InMemoryTraceStorageAdapter implements TraceStoragePort {
  private readonly files = new Map<string, Buffer>();

  save(buffer: Buffer, fileName: string): Promise<string> {
    this.files.set(fileName, buffer);
    return Promise.resolve(`media/traces/${fileName}`);
  }

  getSaved(fileName: string): Buffer | undefined {
    return this.files.get(fileName);
  }
}
