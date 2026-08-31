import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../auth/infrastructure/http/current-user.decorator';
import { AuthenticatedUser } from '../../../auth/infrastructure/http/auth.types';
import { toAuditActor } from '../../../auth/infrastructure/http/audit-actor.mapper';
import {
  CaseAdministration,
  CaseScoped,
} from '../../../access/infrastructure/http/case-scope.decorator';
import { DepositExportedImageCommand } from '../../application/commands/deposit-exported-image/deposit-exported-image.command';
import type { DepositedExportedImage } from '../../application/commands/deposit-exported-image/deposit-exported-image.handler';
import { ListExportedImagesQuery } from '../../application/queries/list-exported-images/list-exported-images.query';
import type { ExportedImageView } from '../../application/queries/list-exported-images/exported-image-read-model';
import { ExportSourcePieceNotFoundError } from '../../domain/exported-image/errors/export-source-piece-not-found.error';
import { UnsupportedExportFormatError } from '../../domain/exported-image/errors/unsupported-export-format.error';
import { DepositExportedImageDto } from './dto/deposit-exported-image.dto';
import { imageFileValidator, UploadedImage } from './image-upload.validators';

@ApiTags('biometrics')
@Controller()
export class ExportsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('investigation-cases/:caseId/exports')
  @CaseAdministration()
  @ApiOperation({
    summary:
      "Déposer sous scellé l'image exportée d'une trace ou d'une empreinte de référence",
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        sourcePieceId: { type: 'string', format: 'uuid' },
      },
      required: ['file', 'sourcePieceId'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Image exportée déposée et scellée',
  })
  @ApiResponse({
    status: 400,
    description:
      'Fichier manquant, format non supporté (PNG/JPEG attendu) ou au-delà de 20 Mo',
  })
  @ApiResponse({
    status: 404,
    description: 'Pièce source introuvable pour ce dossier',
  })
  @UseInterceptors(FileInterceptor('file'))
  async deposit(
    @Param('caseId') caseId: string,
    @UploadedFile(imageFileValidator())
    file: UploadedImage,
    @Body() dto: DepositExportedImageDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DepositedExportedImage> {
    try {
      return await this.commandBus.execute<
        DepositExportedImageCommand,
        DepositedExportedImage
      >(
        new DepositExportedImageCommand(
          toAuditActor(user),
          caseId,
          dto.sourcePieceId,
          file.buffer,
        ),
      );
    } catch (e) {
      if (e instanceof ExportSourcePieceNotFoundError)
        throw new NotFoundException(e.message);
      if (e instanceof UnsupportedExportFormatError)
        throw new BadRequestException(e.message);
      throw e;
    }
  }

  @Get('investigation-cases/:caseId/exports/:pieceId')
  @CaseScoped()
  @ApiOperation({
    summary:
      "Lister les images exportées d'une trace ou d'une empreinte de référence",
  })
  @ApiResponse({
    status: 200,
    description: 'Exports de la pièce, avec adresses signées',
  })
  list(
    @Param('caseId') caseId: string,
    @Param('pieceId') pieceId: string,
  ): Promise<{ data: ExportedImageView[] }> {
    return this.queryBus.execute(new ListExportedImagesQuery(caseId, pieceId));
  }
}
