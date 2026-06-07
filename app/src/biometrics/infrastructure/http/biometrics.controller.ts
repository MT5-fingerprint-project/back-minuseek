import {
  Body,
  Controller,
  FileTypeValidator,
  ParseFilePipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UploadTraceCommand } from '../../application/commands/upload-trace/upload-trace.command';
import { UploadReferencePrintCommand } from '../../application/commands/upload-reference-print/upload-reference-print.command';
import { UploadTraceDto } from './dto/upload-trace.dto';
import { UploadReferencePrintDto } from './dto/upload-reference-print.dto';

const IMAGE_MIME = /^image\/(png|jpe?g|tiff)$/;

const imageFileValidator = () =>
  new ParseFilePipe({
    validators: [new FileTypeValidator({ fileType: IMAGE_MIME })],
    fileIsRequired: true,
  });

@ApiTags('biometrics')
@Controller()
export class BiometricsController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('traces')
  @ApiOperation({ summary: 'Uploader une trace papillaire' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        caseId: { type: 'string', format: 'uuid' },
      },
      required: ['file', 'caseId'],
    },
  })
  @ApiResponse({ status: 201, description: 'Trace uploadée et persistée' })
  @ApiResponse({
    status: 400,
    description:
      'Fichier manquant, type non supporté (PNG/JPEG/TIFF) ou caseId invalide',
  })
  @UseInterceptors(FileInterceptor('file'))
  uploadTrace(
    @UploadedFile(imageFileValidator())
    file: { buffer: Buffer; originalname: string; mimetype: string },
    @Body() dto: UploadTraceDto,
  ) {
    return this.commandBus.execute<
      UploadTraceCommand,
      { id: string; path: string }
    >(
      new UploadTraceCommand(
        file.buffer,
        file.originalname,
        file.mimetype,
        dto.caseId,
      ),
    );
  }

  @Post('reference-prints')
  @ApiOperation({ summary: 'Uploader une empreinte de référence' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        caseId: { type: 'string', format: 'uuid' },
      },
      required: ['file', 'caseId'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Empreinte de référence uploadée et persistée',
  })
  @ApiResponse({
    status: 400,
    description:
      'Fichier manquant, type non supporté (PNG/JPEG/TIFF) ou caseId invalide',
  })
  @UseInterceptors(FileInterceptor('file'))
  uploadReferencePrint(
    @UploadedFile(imageFileValidator())
    file: { buffer: Buffer; originalname: string; mimetype: string },
    @Body() dto: UploadReferencePrintDto,
  ) {
    return this.commandBus.execute<
      UploadReferencePrintCommand,
      { id: string; path: string }
    >(
      new UploadReferencePrintCommand(
        file.buffer,
        file.originalname,
        file.mimetype,
        dto.caseId,
      ),
    );
  }
}
