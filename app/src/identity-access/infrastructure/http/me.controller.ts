import { Controller, Get, NotFoundException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserReadModel } from '../../application/queries/get-user-by-provider-id/user-read-model';
import { ServiceUserReadModel } from '../../application/queries/list-users/service-user-read-model';
import { NoCaseScope } from '../../../access/infrastructure/http/case-scope.decorator';
import { CurrentServiceUser } from './current-service-user.decorator';

@ApiTags('me')
@Controller('me')
export class MeController {
  @Get()
  @NoCaseScope('profil utilisateur, hors périmètre affaire')
  @ApiOperation({ summary: "Profil de l'appelant dans son service" })
  @ApiResponse({ status: 200, description: 'Profil du compte courant' })
  @ApiResponse({
    status: 404,
    description: "Le jeton n'a pas de compte dans ce service",
  })
  me(@CurrentServiceUser() user?: UserReadModel): ServiceUserReadModel {
    if (!user) {
      throw new NotFoundException(
        "Aucun compte de service n'est rattaché à ce jeton",
      );
    }
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      grade: user.grade,
      serviceNumber: user.serviceNumber,
    };
  }
}
