import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TraceNotFoundError } from '../../../domain/trace/errors/trace-not-found.error';
import {
  TRACE_REPOSITORY,
  TraceRepository,
} from '../../../domain/trace/repository/trace.repository';
import {
  IMAGE_STORAGE,
  ImageStoragePort,
} from '../../ports/image-storage.port';
import { DeleteTraceCommand } from './delete-trace.command';

@CommandHandler(DeleteTraceCommand)
export class DeleteTraceHandler implements ICommandHandler<
  DeleteTraceCommand,
  void
> {
  constructor(
    @Inject(TRACE_REPOSITORY)
    private readonly repo: TraceRepository,
    @Inject(IMAGE_STORAGE)
    private readonly storage: ImageStoragePort,
  ) {}

  async execute(cmd: DeleteTraceCommand): Promise<void> {
    const trace = await this.repo.findById(cmd.id);
    if (!trace) {
      throw new TraceNotFoundError(cmd.id);
    }
    await this.repo.delete(cmd.id);
    await this.storage.delete(trace.path);
  }
}
