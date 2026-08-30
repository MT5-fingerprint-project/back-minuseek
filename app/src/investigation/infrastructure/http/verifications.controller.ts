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
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  CaseAdministration,
  NoCaseScope,
} from '../../../access/infrastructure/http/case-scope.decorator';
import { UserReadModel } from '../../../identity-access/application/queries/get-user-by-provider-id/user-read-model';
import { UserRoleEnum } from '../../../identity-access/domain/user/value-objects/user-role.vo';
import { CurrentServiceUser } from '../../../identity-access/infrastructure/http/current-service-user.decorator';
import { AuthenticatedUser } from '../../../auth/infrastructure/http/auth.types';
import { toAuditActor } from '../../../auth/infrastructure/http/audit-actor.mapper';
import { CurrentUser } from '../../../auth/infrastructure/http/current-user.decorator';
import { CompleteCaseVerificationCommand } from '../../application/commands/complete-case-verification/complete-case-verification.command';
import { RecordVerificationConclusionCommand } from '../../application/commands/record-verification-conclusion/record-verification-conclusion.command';
import { RequestCaseVerificationCommand } from '../../application/commands/request-case-verification/request-case-verification.command';
import { GetVerificationQuery } from '../../application/queries/get-verification/get-verification.query';
import { VerificationDetailReadModel } from '../../application/queries/get-verification/verification-detail-read-model';
import { ListCaseVerificationsQuery } from '../../application/queries/list-case-verifications/list-case-verifications.query';
import { ListMyVerificationsQuery } from '../../application/queries/list-my-verifications/list-my-verifications.query';
import { CaseVerificationNotAllowedError } from '../../domain/case-verification/errors/case-verification-not-allowed.error';
import { IncompleteVerificationError } from '../../domain/case-verification/errors/incomplete-verification.error';
import { NotTheVerifierError } from '../../domain/case-verification/errors/not-the-verifier.error';
import { TraceOutsideVerificationError } from '../../domain/case-verification/errors/trace-outside-verification.error';
import { VerificationNotFoundError } from '../../domain/case-verification/errors/verification-not-found.error';
import { SelfVerificationError } from '../../domain/case-verification/errors/self-verification.error';
import { ServiceManagerAsVerifierError } from '../../domain/case-verification/errors/service-manager-as-verifier.error';
import { VerificationAlreadyPendingError } from '../../domain/case-verification/errors/verification-already-pending.error';
import { CaseClosedError } from '../../domain/investigation-case/errors/case-closed.error';
import { CaseNotFoundError } from '../../domain/investigation-case/errors/case-not-found.error';
import { DisabledOperatorError } from '../../domain/investigation-case/errors/disabled-operator.error';
import { UnknownOperatorError } from '../../domain/investigation-case/errors/unknown-operator.error';
import { ListVerificationsDto } from './dto/list-verifications.dto';
import { RecordVerificationConclusionDto } from './dto/record-verification-conclusion.dto';
import { RequestCaseVerificationDto } from './dto/request-case-verification.dto';

const NO_SERVICE_ACCOUNT_MESSAGE =
  "Aucun compte de service n'est rattaché à ce jeton";

@ApiTags('verifications')
@Controller()
export class VerificationsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('investigation-cases/:id/verifications')
  @CaseAdministration()
  @ApiOperation({ summary: "Confier la vérification d'une affaire" })
  @ApiResponse({ status: 201, description: 'Mission de vérification confiée' })
  @ApiResponse({
    status: 400,
    description:
      "Le compte désigné n'existe pas dans ce service, y est désactivé, ou est l'opérateur de l'affaire",
  })
  @ApiResponse({
    status: 403,
    description: "L'appelant n'est ni l'opérateur de l'affaire ni responsable",
  })
  @ApiResponse({ status: 404, description: 'Affaire non trouvée' })
  @ApiResponse({
    status: 409,
    description: 'Affaire close, ou mission déjà en cours pour ce compte',
  })
  async request(
    @Param('id', ParseUUIDPipe) caseId: string,
    @Body() dto: RequestCaseVerificationDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentServiceUser() requester?: UserReadModel,
  ) {
    if (!requester) throw new NotFoundException(NO_SERVICE_ACCOUNT_MESSAGE);

    try {
      const id = await this.commandBus.execute<
        RequestCaseVerificationCommand,
        string
      >(
        new RequestCaseVerificationCommand(
          toAuditActor(user),
          { id: requester.id, role: requester.role as UserRoleEnum },
          caseId,
          dto.verifierUserId,
        ),
      );
      return { id };
    } catch (e) {
      if (e instanceof CaseNotFoundError)
        throw new NotFoundException(e.message);
      if (e instanceof CaseVerificationNotAllowedError)
        throw new ForbiddenException(e.message);
      if (e instanceof SelfVerificationError)
        throw new BadRequestException(e.message);
      if (e instanceof ServiceManagerAsVerifierError)
        throw new BadRequestException(e.message);
      if (e instanceof UnknownOperatorError)
        throw new BadRequestException(e.message);
      if (e instanceof DisabledOperatorError)
        throw new BadRequestException(e.message);
      if (e instanceof CaseClosedError) throw new ConflictException(e.message);
      if (e instanceof VerificationAlreadyPendingError)
        throw new ConflictException(e.message);
      throw e;
    }
  }

  @Get('investigation-cases/:id/verifications')
  @CaseAdministration()
  @ApiOperation({ summary: "Lister les vérifications d'une affaire" })
  @ApiResponse({
    status: 200,
    description: 'Missions de la plus récente à la plus ancienne',
  })
  listForCase(@Param('id', ParseUUIDPipe) caseId: string) {
    return this.queryBus.execute(new ListCaseVerificationsQuery(caseId));
  }

  @Get('verifications')
  @NoCaseScope("les missions de l'appelant, sur toutes ses affaires")
  @ApiOperation({ summary: 'Lister ses propres missions de vérification' })
  @ApiResponse({ status: 200, description: 'Missions en cours' })
  @ApiResponse({ status: 400, description: 'Paramètre `mine` absent ou faux' })
  listMine(
    @Query() _dto: ListVerificationsDto,
    @CurrentServiceUser() requester?: UserReadModel,
  ) {
    return this.queryBus.execute(
      new ListMyVerificationsQuery(requester?.id ?? null),
    );
  }

  @Get('verifications/:id')
  @NoCaseScope("la mission de l'appelant, contrôlée par la query")
  @ApiOperation({ summary: 'Lire sa mission et ses conclusions' })
  @ApiResponse({ status: 200, description: 'Mission et conclusions rendues' })
  @ApiResponse({ status: 404, description: 'Mission non trouvée' })
  async getMine(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentServiceUser() requester?: UserReadModel,
  ) {
    try {
      return await this.queryBus.execute<
        GetVerificationQuery,
        VerificationDetailReadModel
      >(new GetVerificationQuery(id, requester?.id ?? null));
    } catch (e) {
      if (e instanceof VerificationNotFoundError)
        throw new NotFoundException(e.message);
      throw e;
    }
  }

  @Put('verifications/:id/conclusions/:traceId')
  @NoCaseScope("la mission porte l'affaire, la query la contrôle")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Rendre ou réviser sa conclusion sur une trace' })
  @ApiResponse({ status: 204, description: 'Conclusion enregistrée' })
  @ApiResponse({ status: 400, description: 'Trace étrangère au dossier' })
  @ApiResponse({
    status: 403,
    description: "L'appelant n'est pas le vérificateur",
  })
  @ApiResponse({ status: 404, description: 'Mission non trouvée' })
  async conclude(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('traceId', ParseUUIDPipe) traceId: string,
    @Body() dto: RecordVerificationConclusionDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentServiceUser() requester?: UserReadModel,
  ): Promise<void> {
    if (!requester) throw new NotFoundException(NO_SERVICE_ACCOUNT_MESSAGE);

    try {
      await this.commandBus.execute<RecordVerificationConclusionCommand, void>(
        new RecordVerificationConclusionCommand(
          toAuditActor(user),
          requester.id,
          id,
          traceId,
          dto.exploitability,
          dto.identifiedReferencePrintId ?? null,
        ),
      );
    } catch (e) {
      throw this.translated(e);
    }
  }

  @Post('verifications/:id/completion')
  @NoCaseScope("la mission porte l'affaire, la query la contrôle")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Valider sa vérification et confronter ses conclusions',
  })
  @ApiResponse({ status: 204, description: 'Mission close et confrontée' })
  @ApiResponse({
    status: 403,
    description: "L'appelant n'est pas le vérificateur",
  })
  @ApiResponse({ status: 404, description: 'Mission non trouvée' })
  @ApiResponse({
    status: 409,
    description: 'Des traces restent sans conclusion',
  })
  async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentServiceUser() requester?: UserReadModel,
  ): Promise<void> {
    if (!requester) throw new NotFoundException(NO_SERVICE_ACCOUNT_MESSAGE);

    try {
      await this.commandBus.execute<CompleteCaseVerificationCommand, void>(
        new CompleteCaseVerificationCommand(
          toAuditActor(user),
          requester.id,
          id,
        ),
      );
    } catch (e) {
      throw this.translated(e);
    }
  }

  private translated(e: unknown): unknown {
    if (e instanceof VerificationNotFoundError)
      return new NotFoundException(e.message);
    if (e instanceof NotTheVerifierError)
      return new ForbiddenException(e.message);
    if (e instanceof TraceOutsideVerificationError)
      return new BadRequestException(e.message);
    if (e instanceof IncompleteVerificationError)
      return new ConflictException(e.message);
    if (e instanceof CaseClosedError) return new ConflictException(e.message);
    return e;
  }
}
