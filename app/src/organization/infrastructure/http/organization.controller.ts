import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Post,
} from '@nestjs/common';
import { SystemRealmOnly } from '../../../tenancy/infrastructure/http/system-realm-only.decorator';
import {
  CreateOrganizationCommand,
  ProvisionedOrganization,
} from '../../application/commands/create-organization/create-organization.command';
import { CreateOrganizationHandler } from '../../application/commands/create-organization/create-organization.handler';
import {
  InvalidOrganizationSlugError,
  OrganizationAlreadyExistsError,
} from '../../application/organization.errors';
import { CreateOrganizationDto } from './create-organization.dto';

/**
 * Ressource Organization du control-plane. L'autorisation ne se lit pas dans
 * l'URL (ADR-0004) : @SystemRealmOnly() réserve la route au realm système.
 */
@Controller('organizations')
@SystemRealmOnly()
export class OrganizationController {
  constructor(private readonly createOrganization: CreateOrganizationHandler) {}

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
      throw error;
    }
  }
}
