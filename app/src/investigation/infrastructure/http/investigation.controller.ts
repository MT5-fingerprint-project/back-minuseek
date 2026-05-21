import { Body, ConflictException, Controller, Post } from '@nestjs/common';
import { CaseNumberAlreadyExistsError } from '../../domain/investigation-case';
import { OpenInvestigationCaseDto } from './dto/open-investigation-case.dto';
import { OpenInvestigationCaseHandler } from '../../application/commands/open-investigation-case/open-investigation-case.handler';
import { OpenInvestigationCaseCommand } from '../../application/commands/open-investigation-case/open-investigation-case.command';

@Controller('cases')
export class InvestigationController {
  constructor(private readonly handler: OpenInvestigationCaseHandler) {}

  @Post()
  async open(@Body() dto: OpenInvestigationCaseDto) {
    try {
      const id = await this.handler.execute(
        new OpenInvestigationCaseCommand(dto.caseNumber, dto.pvNumber, dto.description),
      );
      return { id };
    } catch (e) {
      if (e instanceof CaseNumberAlreadyExistsError) throw new ConflictException(e.message);
      throw e;
    }
  }
}
