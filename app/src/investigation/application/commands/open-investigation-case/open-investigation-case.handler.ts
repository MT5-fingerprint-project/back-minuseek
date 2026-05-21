import { Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CaseNumberAlreadyExistsError, InvestigationCase } from '../../../domain/investigation-case';
import type { InvestigationCaseRepository } from '../../../domain/ports/investigation-case.repository';
import { INVESTIGATION_CASE_REPOSITORY } from '../../../domain/ports/investigation-case.repository';
import { OpenInvestigationCaseCommand } from './open-investigation-case.command';

export class OpenInvestigationCaseHandler {
  constructor(
    @Inject(INVESTIGATION_CASE_REPOSITORY)
    private readonly repo: InvestigationCaseRepository,
  ) {}

  async execute(cmd: OpenInvestigationCaseCommand): Promise<string> {
    const exists = await this.repo.existsByCaseNumber(cmd.caseNumber);
    if (exists) throw new CaseNumberAlreadyExistsError(cmd.caseNumber);

    const id = randomUUID();
    const newCase = InvestigationCase.open({
      id,
      caseNumber: cmd.caseNumber,
      pvNumber: cmd.pvNumber,
      description: cmd.description,
    });
    await this.repo.save(newCase);
    return id;
  }
}
