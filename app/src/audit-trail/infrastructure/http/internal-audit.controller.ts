import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SystemRealmOnly } from '../../../tenancy/infrastructure/http/system-realm-only.decorator';
import { TenantChainVerificationRunner } from '../verification/tenant-chain-verification.runner';

@ApiTags('audit-trail')
@Controller('internal/audit')
@SystemRealmOnly()
export class InternalAuditController {
  constructor(
    private readonly verificationRunner: TenantChainVerificationRunner,
  ) {}

  @Get('verify')
  @ApiOperation({
    summary:
      "Vérifier l'intégrité des chaînes d'audit (tous les tenants, ou un seul)",
  })
  @ApiResponse({ status: 200, description: 'Récap par tenant' })
  verify(@Query('tenant') tenant?: string) {
    return this.verificationRunner.verify(tenant);
  }
}
