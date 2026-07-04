import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { SystemRealmOnly } from '../../../tenancy/infrastructure/http/system-realm-only.decorator';
import { DeleteOrganizationCommand } from '../../application/commands/delete-organization/delete-organization.command';
import { DeleteOrganizationHandler } from '../../application/commands/delete-organization/delete-organization.handler';
import { CreateOrganizationUserCommand } from '../../application/commands/create-organization-user/create-organization-user.command';
import { CreateOrganizationUserHandler } from '../../application/commands/create-organization-user/create-organization-user.handler';
import { DeleteOrganizationUserCommand } from '../../application/commands/delete-organization-user/delete-organization-user.command';
import { DeleteOrganizationUserHandler } from '../../application/commands/delete-organization-user/delete-organization-user.handler';
import {
  CreateOrganizationCommand,
  ProvisionedOrganization,
} from '../../application/commands/create-organization/create-organization.command';
import { CreateOrganizationHandler } from '../../application/commands/create-organization/create-organization.handler';
import {
  InvalidOrganizationSlugError,
  OrganizationAlreadyExistsError,
  OrganizationNotFoundError,
} from '../../application/organization.errors';
import { ListOrganizationsHandler } from '../../application/queries/list-organizations/list-organizations.handler';
import { ListOrganizationUsersQuery } from '../../application/queries/list-organization-users/list-organization-users.query';
import { ListOrganizationUsersHandler } from '../../application/queries/list-organization-users/list-organization-users.handler';
import { TenantRecord } from '../../../tenancy/application/tenant-registry.service';
import {
  CreatedUser,
  TenantUser,
} from '../../application/ports/identity-provider.port';
import { CreateOrganizationDto } from './create-organization.dto';
import { CreateOrganizationUserDto } from './create-organization-user.dto';

/**
 * Ressource Organization du control-plane. L'autorisation ne se lit pas dans
 * l'URL (ADR-0004) : @SystemRealmOnly() réserve la route au realm système.
 */
@Controller('organizations')
@SystemRealmOnly()
export class OrganizationController {
  constructor(
    private readonly createOrganization: CreateOrganizationHandler,
    private readonly listOrganizations: ListOrganizationsHandler,
    private readonly deleteOrganization: DeleteOrganizationHandler,
    private readonly listOrganizationUsers: ListOrganizationUsersHandler,
    private readonly createOrganizationUser: CreateOrganizationUserHandler,
    private readonly deleteOrganizationUser: DeleteOrganizationUserHandler,
  ) {}

  @Get()
  list(): Promise<TenantRecord[]> {
    return this.listOrganizations.execute();
  }

  @Post()
  async create(
    @Body() dto: CreateOrganizationDto,
  ): Promise<ProvisionedOrganization> {
    try {
      return await this.createOrganization.execute(
        new CreateOrganizationCommand(dto.slug, dto.displayName),
      );
    } catch (error) {
      if (error instanceof InvalidOrganizationSlugError) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof OrganizationAlreadyExistsError) {
        throw new ConflictException(error.message);
      }
      if (error instanceof OrganizationNotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  @Delete(':slug')
  @HttpCode(204)
  async delete(@Param('slug') slug: string): Promise<void> {
    try {
      await this.deleteOrganization.execute(
        new DeleteOrganizationCommand(slug),
      );
    } catch (error) {
      this.rethrowOrganizationError(error);
    }
  }

  @Get(':slug/users')
  async listUsers(@Param('slug') slug: string): Promise<TenantUser[]> {
    try {
      return await this.listOrganizationUsers.execute(
        new ListOrganizationUsersQuery(slug),
      );
    } catch (error) {
      this.rethrowOrganizationError(error);
    }
  }

  @Post(':slug/users')
  async createUser(
    @Param('slug') slug: string,
    @Body() dto: CreateOrganizationUserDto,
  ): Promise<CreatedUser> {
    try {
      return await this.createOrganizationUser.execute(
        new CreateOrganizationUserCommand(
          slug,
          dto.email,
          dto.firstName,
          dto.lastName,
        ),
      );
    } catch (error) {
      this.rethrowOrganizationError(error);
    }
  }

  @Delete(':slug/users/:userId')
  @HttpCode(204)
  async deleteUser(
    @Param('slug') slug: string,
    @Param('userId') userId: string,
  ): Promise<void> {
    try {
      await this.deleteOrganizationUser.execute(
        new DeleteOrganizationUserCommand(slug, userId),
      );
    } catch (error) {
      this.rethrowOrganizationError(error);
    }
  }

  private rethrowOrganizationError(error: unknown): never {
    if (error instanceof InvalidOrganizationSlugError) {
      throw new BadRequestException(error.message);
    }
    if (error instanceof OrganizationAlreadyExistsError) {
      throw new ConflictException(error.message);
    }
    if (error instanceof OrganizationNotFoundError) {
      throw new NotFoundException(error.message);
    }
    throw error;
  }
}
