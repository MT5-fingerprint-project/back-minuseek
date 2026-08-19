import { Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SystemRealmOnly } from '../../../tenancy/infrastructure/http/system-realm-only.decorator';
import { TenantChainAnchoringRunner } from '../verification/tenant-chain-anchoring.runner';
import { TenantChainVerificationRunner } from '../verification/tenant-chain-verification.runner';

@ApiTags('audit-trail')
@Controller('internal/audit')
@SystemRealmOnly()
export class InternalAuditController {
  constructor(
    private readonly verificationRunner: TenantChainVerificationRunner,
    private readonly anchoringRunner: TenantChainAnchoringRunner,
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

  @Post('anchor')
  @ApiOperation({
    summary:
      'Ancrer la tête de chaîne auprès de la TSA (tous les tenants, ou un seul)',
  })
  @ApiResponse({ status: 201, description: 'Récap par tenant' })
  anchor(@Query('tenant') tenant?: string) {
    return this.anchoringRunner.anchor(tenant);
  }
}
