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
import {
  IMAGE_CONVERTER,
  ImageConverterPort,
} from '../../ports/image-converter.port';
import { CASE_STATUS, CaseStatusPort } from '../../ports/case-status.port';
import { storeDisplayableImage } from '../../services/displayable-image';
import { UploadTraceCommand } from './upload-trace.command';

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
    @Inject(IMAGE_CONVERTER)
    private readonly converter: ImageConverterPort,
  ) {}

  async execute(
    cmd: UploadTraceCommand,
  ): Promise<{ id: string; path: string; url: string }> {
    const caseStatus = await this.caseStatus.findStatus(cmd.caseId);
    Trace.assertCaseCanReceiveTrace(cmd.caseId, caseStatus);

    const id = this.idGenerator.generate();
    const storedPath = await storeDisplayableImage(
      this.storage,
      this.converter,
      cmd.fileBuffer,
      cmd.originalName,
      `investigation-case/${cmd.caseId}/traces/${id}`,
    );
    const trace = Trace.upload({
      id,
      path: storedPath,
      caseId: cmd.caseId,
    });
    await this.repo.save(trace);
    const url = await this.storage.getUrl(storedPath);
    return { id, path: storedPath, url };
  }
}
