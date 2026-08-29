import {
  Controller,
  Get,
  NotFoundException,
  Param,
  UseGuards,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PublicRoute } from '../../../auth/infrastructure/http/public-route.decorator';
import { NoCaseScope } from '../../../access/infrastructure/http/case-scope.decorator';
import { FindSealQuery } from '../../application/queries/find-seal/find-seal.query';
import { PublicSealReadModel } from '../../application/queries/find-seal/public-seal-read-model';
import { PublicSealParamsDto } from './dto/public-seal-params.dto';

const PER_MINUTE = 30;

@ApiTags('public')
@PublicRoute()
@NoCaseScope('vérification publique, hors périmètre affaire')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: PER_MINUTE, ttl: 60_000 } })
@Controller('public')
export class PublicSealController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':slug/seals/:sha256')
  @ApiOperation({
    summary: "Vérifier qu'un fichier a été scellé par ce laboratoire",
  })
  @ApiResponse({ status: 200, description: 'Scellé connu' })
  @ApiResponse({
    status: 404,
    description:
      'Empreinte inconnue — ou laboratoire inconnu, sans distinction',
  })
  @ApiResponse({ status: 400, description: 'Paramètre malformé' })
  async find(
    @Param() params: PublicSealParamsDto,
  ): Promise<PublicSealReadModel> {
    const seal = await this.queryBus.execute<
      FindSealQuery,
      PublicSealReadModel | null
    >(new FindSealQuery(params.slug, params.sha256));

    if (seal === null) {
      throw new NotFoundException({ known: false });
    }
    return seal;
  }
}
