import path from 'node:path';
import { Trace } from '../../../domain/trace';
import { TraceRepository } from '../../../domain/trace.repository';
import { TraceIdGenerator } from '../../ports/trace-id-generator.port';
import { TraceStoragePort } from '../../ports/trace-storage.port';
import { UploadTraceCommand } from './upload-trace.command';
import { UploadTraceResult } from './upload-trace.result';

export class UploadTraceHandler {
  constructor(
    private readonly repository: TraceRepository,
    private readonly storage: TraceStoragePort,
    private readonly idGenerator: TraceIdGenerator,
  ) {}

  async execute(command: UploadTraceCommand): Promise<UploadTraceResult> {
    const traceId = this.idGenerator.nextId();
    const fileName = `${traceId}${this.getExtension(command.originalName)}`;
    const storedPath = await this.storage.save(command.fileBuffer, fileName);
    const trace = Trace.upload({
      id: traceId,
      path: storedPath,
      caseId: command.caseId,
    });

    await this.repository.save(trace);

    return { traceId, path: storedPath };
  }

  private getExtension(originalName: string): string {
    const extension = path.extname(originalName);
    return extension.length > 0 ? extension : '.bin';
  }
}
