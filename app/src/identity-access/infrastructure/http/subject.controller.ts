import {
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GetSubjectByIdQuery } from '../../application/queries/get-subject-by-id/get-subject-by-id.query';
import { SubjectReadModel } from '../../application/queries/get-subject-by-id/subject-read-model';
import { ListSubjectsByCaseQuery } from '../../application/queries/list-subjects-by-case/list-subjects-by-case.query';
import { RegisterSubjectCommand } from '../../application/commands/register-subject/register-subject.command';
import { LinkSubjectToCaseCommand } from '../../application/commands/link-subject-to-case/link-subject-to-case.command';
import { SubjectNotFoundError } from '../../domain/subject/errors/subject-not-found.error';
import { SubjectAlreadyLinkedToCaseError } from '../../domain/subject-case/errors/subject-already-linked-to-case.error';
import { RegisterSubjectDto } from './dto/register-subject.dto';
import { ListSubjectsDto } from './dto/list-subjects.dto';

@ApiTags('subjects')
@Controller('subjects')
export class SubjectController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @ApiOperation({
    summary:
      'Rattacher un sujet à une affaire — en le créant, ou en associant un sujet existant via subjectId',
  })
  @ApiResponse({
    status: 201,
    description: 'Sujet créé ou associé, rattaché à l’affaire',
  })
  @ApiResponse({ status: 404, description: 'subjectId fourni mais inconnu' })
  @ApiResponse({
    status: 409,
    description: 'Sujet déjà rattaché à cette affaire',
  })
  async register(@Body() dto: RegisterSubjectDto) {
    if (dto.subjectId) {
      try {
        const id = await this.commandBus.execute<
          LinkSubjectToCaseCommand,
          string
        >(new LinkSubjectToCaseCommand(dto.subjectId, dto.caseId, dto.type));
        return { id };
      } catch (e) {
        if (e instanceof SubjectNotFoundError)
          throw new NotFoundException(e.message);
        if (e instanceof SubjectAlreadyLinkedToCaseError)
          throw new ConflictException(e.message);
        throw e;
      }
    }

    const id = await this.commandBus.execute<RegisterSubjectCommand, string>(
      new RegisterSubjectCommand(
        dto.firstName!,
        dto.lastName!,
        new Date(dto.birthDate!),
        dto.birthPlace!,
        dto.sex!,
        dto.caseId,
        dto.type,
        dto.firstParentName,
        dto.secondParentName,
        dto.phoneNumber,
        dto.color,
      ),
    );
    return { id };
  }

  @Get()
  @ApiOperation({ summary: "Lister les sujets d'une affaire" })
  @ApiResponse({ status: 200, description: "Liste des sujets de l'affaire" })
  @ApiResponse({ status: 400, description: 'caseId manquant ou invalide' })
  listByCase(@Query() dto: ListSubjectsDto) {
    return this.queryBus.execute(new ListSubjectsByCaseQuery(dto.caseId));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un sujet par son id' })
  @ApiResponse({ status: 200, description: 'Détail du sujet' })
  @ApiResponse({ status: 404, description: 'Sujet non trouvé' })
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SubjectReadModel> {
    try {
      return await this.queryBus.execute<GetSubjectByIdQuery, SubjectReadModel>(
        new GetSubjectByIdQuery(id),
      );
    } catch (e) {
      if (e instanceof SubjectNotFoundError)
        throw new NotFoundException(e.message);
      throw e;
    }
  }
}
