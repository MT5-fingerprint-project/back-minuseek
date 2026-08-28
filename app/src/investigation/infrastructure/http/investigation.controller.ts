import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CaseClosedError } from '../../domain/investigation-case/errors/case-closed.error';
import { CaseNumberAlreadyExistsError } from '../../domain/investigation-case/errors/case-number-already-exists.error';
import { CaseNotFoundError } from '../../domain/investigation-case/errors/case-not-found.error';
import { InvalidCaseTransitionError } from '../../domain/investigation-case/errors/invalid-case-transition.error';
import { OperatorChangeNotAllowedError } from '../../domain/investigation-case/errors/operator-change-not-allowed.error';
import { DisabledOperatorError } from '../../domain/investigation-case/errors/disabled-operator.error';
import { UnknownOperatorError } from '../../domain/investigation-case/errors/unknown-operator.error';
import { OpenInvestigationCaseCommand } from '../../application/commands/open-investigation-case/open-investigation-case.command';
import { UpdateInvestigationCaseCommand } from '../../application/commands/update-investigation-case/update-investigation-case.command';
import { CloseInvestigationCaseCommand } from '../../application/commands/close-investigation-case/close-investigation-case.command';
import { ReopenInvestigationCaseCommand } from '../../application/commands/reopen-investigation-case/reopen-investigation-case.command';
import { OpenInvestigationCaseDto } from './dto/open-investigation-case.dto';
import { UpdateInvestigationCaseDto } from './dto/update-investigation-case.dto';
import { ReopenInvestigationCaseDto } from './dto/reopen-investigation-case.dto';
import { ListInvestigationCasesDto } from './dto/list-investigation-cases.dto';
import { ListInvestigationCasesQuery } from '../../application/queries/list-investigation-cases/list-investigation-cases.query';
import { GetInvestigationCaseQuery } from '../../application/queries/get-investigation-case/get-investigation-case.query';
import { InvestigationCaseReadModel } from '../../application/queries/list-investigation-cases/investigation-case-read-model';
import { CurrentUser } from '../../../auth/infrastructure/http/current-user.decorator';
import { AuthenticatedUser } from '../../../auth/infrastructure/http/auth.types';
import { toAuditActor } from '../../../auth/infrastructure/http/audit-actor.mapper';
import { CurrentServiceUser } from '../../../identity-access/infrastructure/http/current-service-user.decorator';
import { UserReadModel } from '../../../identity-access/application/queries/get-user-by-provider-id/user-read-model';
import { UserRoleEnum } from '../../../identity-access/domain/user/value-objects/user-role.vo';
import type { CaseRequester } from '../../../access/application/case-access.service';
import {
  CaseScoped,
  CaseScopedList,
  NoCaseScope,
} from '../../../access/infrastructure/http/case-scope.decorator';

const NO_SERVICE_ACCOUNT_MESSAGE =
  "Aucun compte de service n'est rattaché à ce jeton";

/** Un jeton sans compte dans le service ne voit aucune affaire — il n'en voit
 * surtout pas la totalité. */
const caseRequesterOf = (user?: UserReadModel): CaseRequester | null =>
  user ? { id: user.id, role: user.role as UserRoleEnum } : null;

@ApiTags('investigation-cases')
@Controller('investigation-cases')
export class InvestigationController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @NoCaseScope("création : l'affaire n'existe pas encore")
  @ApiOperation({ summary: 'Ouvrir une nouvelle affaire' })
  @ApiResponse({ status: 201, description: 'affaire créé' })
  @ApiResponse({
    status: 404,
    description: "Le jeton n'a pas de compte dans ce service",
  })
  @ApiResponse({ status: 409, description: "Numéro d'affaire déjà existant" })
  async open(
    @Body() dto: OpenInvestigationCaseDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentServiceUser() author?: UserReadModel,
  ) {
    // todo renommer service en unit  pour eviter confusion avec un service technique (NestJS) et un service métier (unité de police)
    if (!author) throw new NotFoundException(NO_SERVICE_ACCOUNT_MESSAGE);

    try {
      const id = await this.commandBus.execute<
        OpenInvestigationCaseCommand,
        string
      >(
        new OpenInvestigationCaseCommand(
          toAuditActor(user),
          author.id,
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
  @CaseScopedList()
  @ApiOperation({ summary: 'lister les affaires' })
  @ApiResponse({ status: 200, description: 'Liste paginée des affaires' })
  @ApiResponse({
    status: 400,
    description:
      'Paramètres invalides (statut inconnu, page ou limit hors bornes)',
  })
  list(
    @Query() dto: ListInvestigationCasesDto,
    @CurrentServiceUser() requester?: UserReadModel,
  ) {
    return this.queryBus.execute(
      new ListInvestigationCasesQuery(
        dto.status,
        dto.page,
        dto.limit,
        caseRequesterOf(requester),
      ),
    );
  }

  @Get(':id')
  @CaseScoped()
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

  @Patch(':id')
  @CaseScoped()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Corriger les informations d'une affaire" })
  @ApiResponse({ status: 204, description: 'Affaire modifiée' })
  @ApiResponse({
    status: 400,
    description:
      "Le compte désigné comme opérateur n'existe pas dans ce service, ou y est désactivé",
  })
  @ApiResponse({
    status: 403,
    description:
      "L'appelant n'est ni l'opérateur en place ni responsable, et désigne un autre opérateur",
  })
  @ApiResponse({ status: 404, description: 'Affaire non trouvée' })
  @ApiResponse({ status: 409, description: 'Affaire close' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInvestigationCaseDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentServiceUser() requester?: UserReadModel,
  ): Promise<void> {
    if (!requester) throw new NotFoundException(NO_SERVICE_ACCOUNT_MESSAGE);

    try {
      await this.commandBus.execute<UpdateInvestigationCaseCommand, void>(
        new UpdateInvestigationCaseCommand(
          toAuditActor(user),
          { id: requester.id, role: requester.role as UserRoleEnum },
          id,
          {
            pvNumber: dto.pvNumber,
            description: dto.description,
            operatorUserId: dto.operatorUserId,
          },
        ),
      );
    } catch (e) {
      if (e instanceof CaseNotFoundError)
        throw new NotFoundException(e.message);
      if (e instanceof OperatorChangeNotAllowedError)
        throw new ForbiddenException(e.message);
      if (e instanceof UnknownOperatorError)
        throw new BadRequestException(e.message);
      if (e instanceof DisabledOperatorError)
        throw new BadRequestException(e.message);
      if (e instanceof CaseClosedError) throw new ConflictException(e.message);
      throw e;
    }
  }
  @Post(':id/closure')
  @CaseScoped()
  @ApiOperation({
    summary: 'Clore une affaire : le travail technique est fini',
  })
  @ApiResponse({ status: 200, description: "Détail de l'affaire close" })
  @ApiResponse({ status: 404, description: 'Affaire non trouvée' })
  @ApiResponse({ status: 409, description: 'Affaire déjà close' })
  close(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InvestigationCaseReadModel> {
    return this.changeStatus(
      id,
      new CloseInvestigationCaseCommand(toAuditActor(user), id),
    );
  }

  @Post(':id/reopening')
  @CaseScoped()
  @ApiOperation({ summary: 'Rouvrir une affaire close, sur motif écrit' })
  @ApiResponse({ status: 200, description: "Détail de l'affaire rouverte" })
  @ApiResponse({ status: 400, description: 'Motif absent ou trop long' })
  @ApiResponse({ status: 404, description: 'Affaire non trouvée' })
  @ApiResponse({ status: 409, description: "L'affaire n'est pas close" })
  reopen(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReopenInvestigationCaseDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InvestigationCaseReadModel> {
    return this.changeStatus(
      id,
      new ReopenInvestigationCaseCommand(toAuditActor(user), id, dto.reason),
    );
  }

  /** Clore et rouvrir répondent tous deux le détail à jour de l'affaire. */
  private async changeStatus(
    id: string,
    command: CloseInvestigationCaseCommand | ReopenInvestigationCaseCommand,
  ): Promise<InvestigationCaseReadModel> {
    try {
      await this.commandBus.execute(command);
      return await this.queryBus.execute<
        GetInvestigationCaseQuery,
        InvestigationCaseReadModel
      >(new GetInvestigationCaseQuery(id));
    } catch (e) {
      if (e instanceof CaseNotFoundError)
        throw new NotFoundException(e.message);
      if (e instanceof InvalidCaseTransitionError)
        throw new ConflictException(e.message);
      throw e;
    }
  }
}
