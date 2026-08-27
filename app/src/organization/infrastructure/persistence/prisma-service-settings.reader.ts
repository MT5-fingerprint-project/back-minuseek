import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import type { ServiceSettingsReadModel } from '../../application/queries/get-service-settings/service-settings-read-model';
import type { ServiceSettingsReader } from '../../application/queries/get-service-settings/service-settings.reader';
import { SERVICE_SETTINGS_ROW_ID } from './prisma-service-settings.repository';

@Injectable()
export class PrismaServiceSettingsReader implements ServiceSettingsReader {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async find(): Promise<ServiceSettingsReadModel | null> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const row = await prisma.serviceSettings.findUnique({
      where: { id: SERVICE_SETTINGS_ROW_ID },
    });
    if (!row) return null;

    return {
      administration: row.administration,
      serviceName: row.serviceName,
      postalAddress: row.postalAddress,
      phoneNumber: row.phoneNumber,
      email: row.email,
      signatureCity: row.signatureCity,
    };
  }
}
