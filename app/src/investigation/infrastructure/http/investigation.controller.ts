import {
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../auth/infrastructure/http/current-user.decorator';
import { AuthenticatedUser } from '../../../auth/infrastructure/http/auth.types';
import { resolveInvestigationCaseScope } from './investigation-case-scope';
import { CaseNumberAlreadyExistsError } from '../../domain/investigation-case/errors/case-number-already-exists.error';
import { CaseNotFoundError } from '../../domain/investigation-case/errors/case-not-found.error';
import { OpenInvestigationCaseCommand } from '../../application/commands/open-investigation-case/open-investigation-case.command';
import { OpenInvestigationCaseDto } from './dto/open-investigation-case.dto';
import { ListInvestigationCasesDto } from './dto/list-investigation-cases.dto';
import { ListInvestigationCasesQuery } from '../../application/queries/list-investigation-cases/list-investigation-cases.query';
import { GetInvestigationCaseQuery } from '../../application/queries/get-investigation-case/get-investigation-case.query';
import { InvestigationCaseReadModel } from '../../application/queries/list-investigation-cases/investigation-case-read-model';

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
  async open(
    @Body() dto: OpenInvestigationCaseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    resolveInvestigationCaseScope(user);
    try {
      const id = await this.commandBus.execute<
        OpenInvestigationCaseCommand,
        string
      >(
        new OpenInvestigationCaseCommand(
          dto.caseNumber,
          dto.pvNumber,
          user.sub,
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
  @ApiResponse({
    status: 400,
    description:
      'Paramètres invalides (statut inconnu, page ou limit hors bornes)',
  })
  list(
    @Query() dto: ListInvestigationCasesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const scope = resolveInvestigationCaseScope(user);
    return this.queryBus.execute(
      new ListInvestigationCasesQuery(
        dto.status,
        dto.page,
        dto.limit,
        scope.operatorId,
      ),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: "Récupérer le détail d'une affaire" })
  @ApiResponse({ status: 200, description: "Détail de l'affaire" })
  @ApiResponse({ status: 404, description: 'Affaire non trouvée' })
  async getById(@Param('id') id: string) {
    try {
      return await this.queryBus.execute<
        GetInvestigationCaseQuery,
        InvestigationCaseReadModel
      >(new GetInvestigationCaseQuery(id));
    } catch (e) {
      if (e instanceof CaseNotFoundError)
        throw new NotFoundException(e.message);
      throw e;
    }
  }
}
