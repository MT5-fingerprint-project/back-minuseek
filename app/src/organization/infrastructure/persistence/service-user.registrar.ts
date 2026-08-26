import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { TenantContextService } from '../../../tenancy/application/tenant-context.service';
import { RegisterUserCommand } from '../../../identity-access/application/commands/register-user/register-user.command';
import {
  ServiceNumberAlreadyExistsError,
  UserAlreadyRegisteredError,
} from '../../../identity-access/domain/user/errors/user-already-registered.error';
import {
  ServiceUserRegistrarPort,
  ServiceUserToRegister,
} from '../../application/ports/service-user-registrar.port';
import { OrganizationUserConflictError } from '../../application/organization.errors';

@Injectable()
export class ServiceUserRegistrar implements ServiceUserRegistrarPort {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly tenantContext: TenantContextService,
  ) {}

  async register(user: ServiceUserToRegister): Promise<void> {
    try {
      await this.tenantContext.run({ slug: user.organizationSlug }, () =>
        this.commandBus.execute(
          new RegisterUserCommand(
            user.identityProviderId,
            user.role,
            user.grade,
            user.serviceNumber,
            user.firstName,
            user.lastName,
          ),
        ),
      );
    } catch (error) {
      if (
        error instanceof UserAlreadyRegisteredError ||
        error instanceof ServiceNumberAlreadyExistsError
      ) {
        throw new OrganizationUserConflictError(error.message);
      }
      throw error;
    }
  }
}
