import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InvestigationCase } from '../../../domain/investigation-case/entity/investigation-case';
import { CaseNumberAlreadyExistsError } from '../../../domain/investigation-case/errors/case-number-already-exists.error';
import { INVESTIGATION_CASE_REPOSITORY, InvestigationCaseRepository } from '../../../domain/investigation-case/repository/investigation-case.repository';
import { ID_GENERATOR, IdGenerator } from '../../../../shared/domain/ports/id-generator';
import { OpenInvestigationCaseCommand } from './open-investigation-case.command';

@CommandHandler(OpenInvestigationCaseCommand)
export class OpenInvestigationCaseHandler implements ICommandHandler<OpenInvestigationCaseCommand, string> {
  constructor(
    @Inject(INVESTIGATION_CASE_REPOSITORY)
    private readonly repo: InvestigationCaseRepository,
    @Inject(ID_GENERATOR)
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(cmd: OpenInvestigationCaseCommand): Promise<string> {
    const exists = await this.repo.existsByCaseNumber(cmd.caseNumber);
    if (exists) throw new CaseNumberAlreadyExistsError(cmd.caseNumber);

    const id = this.idGenerator.generate();
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
