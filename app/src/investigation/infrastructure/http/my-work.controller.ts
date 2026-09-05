import { Controller, Get, NotFoundException } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NoCaseScope } from '../../../access/infrastructure/http/case-scope.decorator';
import { UserReadModel } from '../../../identity-access/application/queries/get-user-by-provider-id/user-read-model';
import { CurrentServiceUser } from '../../../identity-access/infrastructure/http/current-service-user.decorator';
import { GetMyWorkQuery } from '../../application/queries/get-my-work/get-my-work.query';
import { MyWorkReadModel } from '../../application/queries/get-my-work/my-work-read-model';

const NO_SERVICE_ACCOUNT_MESSAGE =
  "Aucun compte de service n'est rattaché à ce jeton";

const NO_CASE_SCOPE_REASON =
  "travail de l'appelant : aucune affaire en paramètre";

@ApiTags('my-work')
@Controller('my-work')
export class MyWorkController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @NoCaseScope(NO_CASE_SCOPE_REASON)
  @ApiOperation({ summary: "Ce qui attend l'opérateur qui appelle" })
  @ApiResponse({
    status: 200,
    description:
      "Production de l'année, dossiers en cours, discordances et traces en attente",
  })
  @ApiResponse({
    status: 404,
    description: 'Jeton sans compte dans ce service',
  })
  async mine(
    @CurrentServiceUser() requester?: UserReadModel,
  ): Promise<MyWorkReadModel> {
    if (!requester) throw new NotFoundException(NO_SERVICE_ACCOUNT_MESSAGE);

    // Le périmètre ne vient jamais du client : il est pris sur le jeton.
    return await this.queryBus.execute<GetMyWorkQuery, MyWorkReadModel>(
      new GetMyWorkQuery(requester.id),
    );
  }
}
