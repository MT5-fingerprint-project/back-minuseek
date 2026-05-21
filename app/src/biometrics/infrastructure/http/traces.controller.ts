import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadTraceHandler } from '../../application/commands/upload-trace/upload-trace.handler';
import { UploadTraceResult } from '../../application/commands/upload-trace/upload-trace.result';

@Controller()
export class TracesController {
  constructor(private readonly uploadTraceHandler: UploadTraceHandler) {}

  @Post('traces')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile()
    file?: { buffer: Buffer; originalname: string; mimetype: string },
    @Body('caseId') caseId?: string,
  ): Promise<UploadTraceResult> {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    return this.uploadTraceHandler.execute({
      fileBuffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      caseId,
    });
  }
}
