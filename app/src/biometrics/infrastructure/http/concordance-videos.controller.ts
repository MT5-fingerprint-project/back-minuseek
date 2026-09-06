import {
  BadRequestException,
  Body,
  Controller,
  NotFoundException,
  Param,
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
import { CurrentUser } from '../../../auth/infrastructure/http/current-user.decorator';
import { AuthenticatedUser } from '../../../auth/infrastructure/http/auth.types';
import { toAuditActor } from '../../../auth/infrastructure/http/audit-actor.mapper';
import { CaseAdministration } from '../../../access/infrastructure/http/case-scope.decorator';
import { DepositConcordanceVideoCommand } from '../../application/commands/deposit-concordance-video/deposit-concordance-video.command';
import type { DepositedConcordanceVideo } from '../../application/commands/deposit-concordance-video/deposit-concordance-video.handler';
import { ConcordancePairNotFoundError } from '../../domain/concordance-video/errors/concordance-pair-not-found.error';
import { UnsupportedConcordanceVideoFormatError } from '../../domain/concordance-video/errors/unsupported-concordance-video-format.error';
import { DepositConcordanceVideoDto } from './dto/deposit-concordance-video.dto';
import { UploadedVideo, videoFileValidator } from './video-upload.validators';

@ApiTags('biometrics')
@Controller()
export class ConcordanceVideosController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('investigation-cases/:caseId/concordance-videos')
  @CaseAdministration()
  @ApiOperation({
    summary:
      "Déposer sous scellé la vidéo de démonstration des concordances d'un couple trace / empreinte",
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        traceId: { type: 'string', format: 'uuid' },
        referencePrintId: { type: 'string', format: 'uuid' },
      },
      required: ['file', 'traceId', 'referencePrintId'],
    },
  })
  @ApiResponse({ status: 201, description: 'Vidéo déposée et scellée' })
  @ApiResponse({
    status: 400,
    description:
      'Fichier manquant, format non supporté (MP4/WebM attendu) ou au-delà de 100 Mo',
  })
  @ApiResponse({
    status: 404,
    description: 'Couple trace / empreinte introuvable pour ce dossier',
  })
  @UseInterceptors(FileInterceptor('file'))
  async deposit(
    @Param('caseId') caseId: string,
    @UploadedFile(videoFileValidator())
    file: UploadedVideo,
    @Body() dto: DepositConcordanceVideoDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DepositedConcordanceVideo> {
    try {
      return await this.commandBus.execute<
        DepositConcordanceVideoCommand,
        DepositedConcordanceVideo
      >(
        new DepositConcordanceVideoCommand(
          toAuditActor(user),
          caseId,
          dto.traceId,
          dto.referencePrintId,
          file.buffer,
        ),
      );
    } catch (e) {
      if (e instanceof ConcordancePairNotFoundError)
        throw new NotFoundException(e.message);
      if (e instanceof UnsupportedConcordanceVideoFormatError)
        throw new BadRequestException(e.message);
      throw e;
    }
  }
}
