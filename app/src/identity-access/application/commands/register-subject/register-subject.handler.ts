import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { Subject } from '../../../domain/subject/entity/subject';
import { victimShortLabel } from '../../../domain/subject/victim-designation';
import { Sex } from '../../../domain/subject/value-objects/sex.vo';
import {
  SubjectType,
  SubjectTypeEnum,
} from '../../../domain/subject/value-objects/subject-type.vo';
import {
  SUBJECT_REPOSITORY,
  SubjectRepository,
} from '../../../domain/subject/repository/subject.repository';
import {
  ID_GENERATOR,
  IdGenerator,
} from '../../../../shared/domain/ports/id-generator';
import { RegisterSubjectCommand } from './register-subject.command';

/** Le journal porte les valeurs en clair, sauf le nom d'une victime : lui n'y
 * entre qu'abrégé, parce que cette table refuse `UPDATE` et `DELETE`. */
function designationOf(subject: Subject): string {
  return subject.type.getValue() === SubjectTypeEnum.VICTIM
    ? victimShortLabel(subject)
    : `${subject.lastName} ${subject.firstName}`;
}

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
    await this.repo.save(subject, {
      eventType: AuditEventTypeEnum.SUBJECT_REGISTERED,
      evidenceClass: EvidenceClassEnum.OBSERVED,
      actor: cmd.actor,
      caseId: subject.caseId,
      payload: {
        designation: designationOf(subject),
        sex: subject.sex.getValue(),
        type: subject.type.getValue(),
      },
    });
    return id;
  }
}
