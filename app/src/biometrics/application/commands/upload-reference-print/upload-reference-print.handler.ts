import path from 'node:path';
import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ReferencePrint } from '../../../domain/reference-print/entity/reference-print';
import { FingerPosition } from '../../../domain/reference-print/value-objects/finger-position.vo';
import {
  REFERENCE_PRINT_REPOSITORY,
  ReferencePrintRepository,
} from '../../../domain/reference-print/repository/reference-print.repository';
import {
  ID_GENERATOR,
  IdGenerator,
} from '../../../../shared/domain/ports/id-generator';
import {
  IMAGE_STORAGE,
  ImageStoragePort,
} from '../../ports/image-storage.port';
import { UploadReferencePrintCommand } from './upload-reference-print.command';

@CommandHandler(UploadReferencePrintCommand)
export class UploadReferencePrintHandler implements ICommandHandler<
  UploadReferencePrintCommand,
  { id: string; path: string; url: string }
> {
  constructor(
    @Inject(REFERENCE_PRINT_REPOSITORY)
    private readonly repo: ReferencePrintRepository,
    @Inject(IMAGE_STORAGE)
    private readonly storage: ImageStoragePort,
    @Inject(ID_GENERATOR)
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(
    cmd: UploadReferencePrintCommand,
  ): Promise<{ id: string; path: string; url: string }> {
    const id = this.idGenerator.generate();
    const relativePath = `investigation-case/${cmd.caseId}/reference-prints/${id}${this.getExtension(cmd.originalName)}`;
    const storedPath = await this.storage.save(cmd.fileBuffer, relativePath);
    const referencePrint = ReferencePrint.create({
      id,
      path: storedPath,
      caseId: cmd.caseId,
      subjectId: cmd.subjectId ?? null,
      position: cmd.position ? FingerPosition.from(cmd.position) : null,
    });
    await this.repo.save(referencePrint);
    const url = await this.storage.getUrl(storedPath);
    return { id, path: storedPath, url };
  }

  private getExtension(originalName: string): string {
    const extension = path.extname(originalName);
    return extension.length > 0 ? extension : '.bin';
  }
}
