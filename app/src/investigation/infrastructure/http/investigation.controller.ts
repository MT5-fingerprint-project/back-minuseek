import {
  Body,
  ConflictException,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CaseNumberAlreadyExistsError } from '../../domain/investigation-case/errors/case-number-already-exists.error';
import { OpenInvestigationCaseCommand } from '../../application/commands/open-investigation-case/open-investigation-case.command';
import { OpenInvestigationCaseDto } from './dto/open-investigation-case.dto';
import { ListInvestigationCasesDto } from './dto/list-investigation-cases.dto';
import {
  ListInvestigationCasesQuery
} from '../../application/queries/list-investigation-cases/list-investigation-cases.query';

@ApiTags('investigation-cases')
@Controller('investigation-cases')
export class InvestigationController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Ouvrir une nouvelle affaire' })
  @ApiResponse({ status: 201, description: 'affaire créé' })
  @ApiResponse({ status: 409, description: "Numéro d'affaire déjà existant" })
  async open(@Body() dto: OpenInvestigationCaseDto) {
    try {
      const id = await this.commandBus.execute<
        OpenInvestigationCaseCommand,
        string
      >(
        new OpenInvestigationCaseCommand(
          dto.caseNumber,
          dto.pvNumber,
          dto.description,
        ),
      );
      return { id };
    } catch (e) {
      if (e instanceof CaseNumberAlreadyExistsError)
        throw new ConflictException(e.message);
      throw e;
    }
  }

  @Get()
  @ApiOperation({ summary: 'lister les affaires' })
  @ApiResponse({ status: 200, description: 'Liste paginée des affaires' })
  @ApiResponse({ status: 404, description: 'Aucune Affaire' })
  list(@Query() dto: ListInvestigationCasesDto) {
    return this.queryBus.execute(
      new ListInvestigationCasesQuery(dto.status, dto.page, dto.limit),
    );
  }
}
