import { Body, ConflictException, Controller, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CaseNumberAlreadyExistsError } from '../../domain/investigation-case/errors/case-number-already-exists.error';
import { OpenInvestigationCaseCommand } from '../../application/commands/open-investigation-case/open-investigation-case.command';
import { OpenInvestigationCaseDto } from './dto/open-investigation-case.dto';

@ApiTags('cases')
@Controller('cases')
export class InvestigationController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  @ApiOperation({ summary: 'Ouvrir un nouveau dossier d\'investigation' })
  @ApiResponse({ status: 201, description: 'Dossier créé' })
  @ApiResponse({ status: 409, description: 'Numéro de dossier déjà existant' })
  async open(@Body() dto: OpenInvestigationCaseDto) {
    try {
      const id = await this.commandBus.execute<OpenInvestigationCaseCommand, string>(
        new OpenInvestigationCaseCommand(dto.caseNumber, dto.pvNumber, dto.description),
      );
      return { id };
    } catch (e) {
      if (e instanceof CaseNumberAlreadyExistsError) throw new ConflictException(e.message);
      throw e;
    }
  }
}
