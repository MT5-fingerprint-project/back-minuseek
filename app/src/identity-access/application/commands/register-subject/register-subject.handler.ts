import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Subject } from '../../../domain/subject/entity/subject';
import { Sex } from '../../../domain/subject/value-objects/sex.vo';
import {
  SUBJECT_REPOSITORY,
  SubjectRepository,
} from '../../../domain/subject/repository/subject.repository';
import { SubjectCase } from '../../../domain/subject-case/entity/subject-case';
import { SubjectType } from '../../../domain/subject-case/value-objects/subject-type.vo';
import {
  SUBJECT_CASE_REPOSITORY,
  SubjectCaseRepository,
} from '../../../domain/subject-case/repository/subject-case.repository';
import {
  ID_GENERATOR,
  IdGenerator,
} from '../../../../shared/domain/ports/id-generator';
import { RegisterSubjectCommand } from './register-subject.command';

@CommandHandler(RegisterSubjectCommand)
export class RegisterSubjectHandler implements ICommandHandler<
  RegisterSubjectCommand,
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

  async execute(cmd: RegisterSubjectCommand): Promise<string> {
    const id = this.idGenerator.generate();
    const subject = Subject.register({
      id,
      firstName: cmd.firstName,
      lastName: cmd.lastName,
      birthDate: cmd.birthDate,
      birthPlace: cmd.birthPlace,
      firstParentName: cmd.firstParentName,
      secondParentName: cmd.secondParentName,
      phoneNumber: cmd.phoneNumber,
      sex: Sex.from(cmd.sex),
      color: cmd.color,
    });
    await this.subjectRepo.save(subject);

    const subjectCase = SubjectCase.create({
      id: this.idGenerator.generate(),
      subjectId: id,
      caseId: cmd.caseId,
      type: SubjectType.from(cmd.type),
    });
    await this.subjectCaseRepo.save(subjectCase);

    return id;
  }
}
