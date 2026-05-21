import fs from 'node:fs/promises';
import path from 'node:path';
import { TraceStoragePort } from '../../application/ports/trace-storage.port';

export class LocalTraceStorageAdapter implements TraceStoragePort {
  constructor(
    private readonly baseDir = path.join(process.cwd(), 'media', 'traces'),
  ) {}

  async save(buffer: Buffer, fileName: string): Promise<string> {
    await fs.mkdir(this.baseDir, { recursive: true });
    const targetPath = path.join(this.baseDir, fileName);
    await fs.writeFile(targetPath, buffer);
    return `media/traces/${fileName}`;
  }
}
