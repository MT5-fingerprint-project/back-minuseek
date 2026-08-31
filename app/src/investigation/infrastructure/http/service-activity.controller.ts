import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NoCaseScope } from '../../../access/infrastructure/http/case-scope.decorator';
import { UserReadModel } from '../../../identity-access/application/queries/get-user-by-provider-id/user-read-model';
import { UserRoleEnum } from '../../../identity-access/domain/user/value-objects/user-role.vo';
import { CurrentServiceUser } from '../../../identity-access/infrastructure/http/current-service-user.decorator';
import { GetServiceActivityQuery } from '../../application/queries/get-service-activity/get-service-activity.query';
import { ServiceActivityReadModel } from '../../application/queries/get-service-activity/service-activity-read-model';
import { ServiceActivityNotAllowedError } from '../../domain/investigation-case/errors/service-activity-not-allowed.error';
import { UnknownOperatorError } from '../../domain/investigation-case/errors/unknown-operator.error';
import { GetServiceActivityDto } from './dto/get-service-activity.dto';

const NO_SERVICE_ACCOUNT_MESSAGE =
  "Aucun compte de service n'est rattaché à ce jeton";

const NO_CASE_SCOPE_REASON =
  'activité du service : aucune affaire en paramètre';

@ApiTags('service-activity')
@Controller('service-activity')
export class ServiceActivityController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @NoCaseScope(NO_CASE_SCOPE_REASON)
  @ApiOperation({ summary: "Chiffres du service pour l'année civile en cours" })
  @ApiResponse({
    status: 200,
    description: 'Charge, délais, flux mensuel et étapes des traces',
  })
  @ApiResponse({
    status: 400,
    description: "L'opérateur passé n'est pas un UUID",
  })
  @ApiResponse({ status: 403, description: "L'appelant n'est pas responsable" })
  @ApiResponse({
    status: 404,
    description: 'Opérateur inconnu, ou jeton sans compte dans ce service',
  })
  async service(
    @Query() dto: GetServiceActivityDto,
    @CurrentServiceUser() requester?: UserReadModel,
  ): Promise<ServiceActivityReadModel> {
    if (!requester) throw new NotFoundException(NO_SERVICE_ACCOUNT_MESSAGE);

    try {
      return await this.queryBus.execute<
        GetServiceActivityQuery,
        ServiceActivityReadModel
      >(
        new GetServiceActivityQuery(
          { id: requester.id, role: requester.role as UserRoleEnum },
          dto.operatorUserId,
        ),
      );
    } catch (error) {
      if (error instanceof ServiceActivityNotAllowedError) {
        throw new ForbiddenException(error.message);
      }
      if (error instanceof UnknownOperatorError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }
}
