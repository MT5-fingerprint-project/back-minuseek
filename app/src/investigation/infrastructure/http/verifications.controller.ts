import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
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
import { RequestCaseVerificationCommand } from '../../application/commands/request-case-verification/request-case-verification.command';
import { ListCaseVerificationsQuery } from '../../application/queries/list-case-verifications/list-case-verifications.query';
import { ListMyVerificationsQuery } from '../../application/queries/list-my-verifications/list-my-verifications.query';
import { CaseVerificationNotAllowedError } from '../../domain/case-verification/errors/case-verification-not-allowed.error';
import { SelfVerificationError } from '../../domain/case-verification/errors/self-verification.error';
import { ServiceManagerAsVerifierError } from '../../domain/case-verification/errors/service-manager-as-verifier.error';
import { VerificationAlreadyPendingError } from '../../domain/case-verification/errors/verification-already-pending.error';
import { CaseClosedError } from '../../domain/investigation-case/errors/case-closed.error';
import { CaseNotFoundError } from '../../domain/investigation-case/errors/case-not-found.error';
import { DisabledOperatorError } from '../../domain/investigation-case/errors/disabled-operator.error';
import { UnknownOperatorError } from '../../domain/investigation-case/errors/unknown-operator.error';
import { ListVerificationsDto } from './dto/list-verifications.dto';
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
}
