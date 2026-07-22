import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  SUBJECT_REPOSITORY,
  SubjectRepository,
} from '../../../domain/subject/repository/subject.repository';
import { SubjectNotFoundError } from '../../../domain/subject/errors/subject-not-found.error';
import { SubjectCase } from '../../../domain/subject-case/entity/subject-case';
import { SubjectType } from '../../../domain/subject-case/value-objects/subject-type.vo';
import {
  SUBJECT_CASE_REPOSITORY,
  SubjectCaseRepository,
} from '../../../domain/subject-case/repository/subject-case.repository';
import { SubjectAlreadyLinkedToCaseError } from '../../../domain/subject-case/errors/subject-already-linked-to-case.error';
import {
  ID_GENERATOR,
  IdGenerator,
} from '../../../../shared/domain/ports/id-generator';
import { LinkSubjectToCaseCommand } from './link-subject-to-case.command';

@CommandHandler(LinkSubjectToCaseCommand)
export class LinkSubjectToCaseHandler implements ICommandHandler<
  LinkSubjectToCaseCommand,
  string
> {
  constructor(
    @Inject(SUBJECT_REPOSITORY)
    private readonly subjectRepo: SubjectRepository,
    @Inject(SUBJECT_CASE_REPOSITORY)
    private readonly subjectCaseRepo: SubjectCaseRepository,
    @Inject(ID_GENERATOR)
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(cmd: LinkSubjectToCaseCommand): Promise<string> {
    const subject = await this.subjectRepo.findById(cmd.subjectId);
    if (!subject) {
      throw new SubjectNotFoundError(cmd.subjectId);
    }
    if (
      await this.subjectCaseRepo.existsBySubjectAndCase(
        cmd.subjectId,
        cmd.caseId,
      )
    ) {
      throw new SubjectAlreadyLinkedToCaseError(cmd.subjectId, cmd.caseId);
    }

    const subjectCase = SubjectCase.create({
      id: this.idGenerator.generate(),
      subjectId: cmd.subjectId,
      caseId: cmd.caseId,
      type: SubjectType.from(cmd.type),
    });
    await this.subjectCaseRepo.save(subjectCase);

    return cmd.subjectId;
  }
}
