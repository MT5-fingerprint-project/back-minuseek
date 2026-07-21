import {
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GetUserByProviderIdQuery } from '../../application/queries/get-user-by-provider-id/get-user-by-provider-id.query';
import { UserReadModel } from '../../application/queries/get-user-by-provider-id/user-read-model';
import { RegisterUserCommand } from '../../application/commands/register-user/register-user.command';
import { UserNotFoundError } from '../../domain/user/errors/user-not-found.error';
import {
  ServiceNumberAlreadyExistsError,
  UserAlreadyRegisteredError,
} from '../../domain/user/errors/user-already-registered.error';
import { RegisterUserDto } from './dto/register-user.dto';

@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Enregistrer un nouvel utilisateur' })
  @ApiResponse({ status: 201, description: 'Utilisateur créé' })
  @ApiResponse({
    status: 409,
    description: 'Identity provider id ou numéro de service déjà existant',
  })
  async register(@Body() dto: RegisterUserDto) {
    try {
      const id = await this.commandBus.execute<RegisterUserCommand, string>(
        new RegisterUserCommand(
          dto.identityProviderId,
          dto.role,
          dto.grade,
          dto.serviceNumber,
          dto.firstName,
          dto.lastName,
        ),
      );
      return { id };
    } catch (e) {
      if (
        e instanceof UserAlreadyRegisteredError ||
        e instanceof ServiceNumberAlreadyExistsError
      ) {
        throw new ConflictException(e.message);
      }
      throw e;
    }
  }

  @Get('by-provider-id/:identityProviderId')
  @ApiOperation({
    summary:
      'Récupérer un utilisateur par son identity provider id (sub Keycloak)',
  })
  @ApiResponse({ status: 200, description: "Détail de l'utilisateur" })
  @ApiResponse({ status: 404, description: 'Utilisateur non trouvé' })
  async getByProviderId(
    @Param('identityProviderId') identityProviderId: string,
  ): Promise<UserReadModel> {
    try {
      return await this.queryBus.execute<
        GetUserByProviderIdQuery,
        UserReadModel
      >(new GetUserByProviderIdQuery(identityProviderId));
    } catch (e) {
      if (e instanceof UserNotFoundError)
        throw new NotFoundException(e.message);
      throw e;
    }
  }
}
