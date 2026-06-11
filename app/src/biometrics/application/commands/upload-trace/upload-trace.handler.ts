import path from 'node:path';
import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Trace } from '../../../domain/trace/entity/trace';
import {
  TRACE_REPOSITORY,
  TraceRepository,
} from '../../../domain/trace/repository/trace.repository';
import {
  ID_GENERATOR,
  IdGenerator,
} from '../../../../shared/domain/ports/id-generator';
import {
  IMAGE_STORAGE,
  ImageStoragePort,
} from '../../ports/image-storage.port';
import { UploadTraceCommand } from './upload-trace.command';

@CommandHandler(UploadTraceCommand)
export class UploadTraceHandler implements ICommandHandler<
  UploadTraceCommand,
  { id: string; path: string }
> {
  constructor(
    @Inject(TRACE_REPOSITORY)
    private readonly repo: TraceRepository,
    @Inject(IMAGE_STORAGE)
    private readonly storage: ImageStoragePort,
    @Inject(ID_GENERATOR)
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(
    cmd: UploadTraceCommand,
  ): Promise<{ id: string; path: string }> {
    const id = this.idGenerator.generate();
    const relativePath = `investigation-case/${cmd.caseId}/traces/${id}${this.getExtension(cmd.originalName)}`;
    const storedPath = await this.storage.save(cmd.fileBuffer, relativePath);
    const trace = Trace.upload({
      id,
      path: storedPath,
      caseId: cmd.caseId,
    });
    await this.repo.save(trace);
    return { id, path: storedPath };
  }

  private getExtension(originalName: string): string {
    const extension = path.extname(originalName);
    return extension.length > 0 ? extension : '.bin';
  }
}
