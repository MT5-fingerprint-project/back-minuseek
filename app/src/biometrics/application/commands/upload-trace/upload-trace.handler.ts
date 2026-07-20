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
import { CASE_STATUS, CaseStatusPort } from '../../ports/case-status.port';
import { CaseUnavailableForTraceError } from '../../../domain/trace/errors/case-unavailable-for-trace.error';
import { UploadTraceCommand } from './upload-trace.command';

const ACCEPTED_CASE_STATUSES = ['OPEN', 'IN_PROGRESS'];

@CommandHandler(UploadTraceCommand)
export class UploadTraceHandler implements ICommandHandler<
  UploadTraceCommand,
  { id: string; path: string; url: string }
> {
  constructor(
    @Inject(TRACE_REPOSITORY)
    private readonly repo: TraceRepository,
    @Inject(IMAGE_STORAGE)
    private readonly storage: ImageStoragePort,
    @Inject(ID_GENERATOR)
    private readonly idGenerator: IdGenerator,
    @Inject(CASE_STATUS)
    private readonly caseStatus: CaseStatusPort,
  ) {}

  async execute(
    cmd: UploadTraceCommand,
  ): Promise<{ id: string; path: string; url: string }> {
    const caseStatus = await this.caseStatus.findStatus(cmd.caseId);
    if (caseStatus === null || !ACCEPTED_CASE_STATUSES.includes(caseStatus)) {
      throw new CaseUnavailableForTraceError(cmd.caseId);
    }

    const id = this.idGenerator.generate();
    const relativePath = `investigation-case/${cmd.caseId}/traces/${id}${this.getExtension(cmd.originalName)}`;
    const storedPath = await this.storage.save(cmd.fileBuffer, relativePath);
    const trace = Trace.upload({
      id,
      path: storedPath,
      caseId: cmd.caseId,
    });
    await this.repo.save(trace);
    const url = await this.storage.getUrl(storedPath);
    return { id, path: storedPath, url };
  }

  private getExtension(originalName: string): string {
    const extension = path.extname(originalName);
    return extension.length > 0 ? extension : '.bin';
  }
}
