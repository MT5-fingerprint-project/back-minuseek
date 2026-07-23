import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Subject } from '../../../domain/subject/entity/subject';
import { Sex } from '../../../domain/subject/value-objects/sex.vo';
import { SubjectType } from '../../../domain/subject/value-objects/subject-type.vo';
import {
  SUBJECT_REPOSITORY,
  SubjectRepository,
} from '../../../domain/subject/repository/subject.repository';
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
    private readonly repo: SubjectRepository,
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
      type: SubjectType.from(cmd.type),
      color: cmd.color,
      caseId: cmd.caseId,
    });
    await this.repo.save(subject);
    return id;
  }
}
