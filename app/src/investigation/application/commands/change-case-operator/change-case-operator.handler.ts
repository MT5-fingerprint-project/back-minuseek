import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UserRoleEnum } from '../../../../identity-access/domain/user/value-objects/user-role.vo';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { CaseNotFoundError } from '../../../domain/investigation-case/errors/case-not-found.error';
import { OperatorChangeNotAllowedError } from '../../../domain/investigation-case/errors/operator-change-not-allowed.error';
import { UnknownOperatorError } from '../../../domain/investigation-case/errors/unknown-operator.error';
import {
  INVESTIGATION_CASE_REPOSITORY,
  InvestigationCaseRepository,
} from '../../../domain/investigation-case/repository/investigation-case.repository';
import {
  SERVICE_USER_DIRECTORY,
  ServiceUserDirectory,
} from '../../ports/service-user.directory';
import { ChangeCaseOperatorCommand } from './change-case-operator.command';

@CommandHandler(ChangeCaseOperatorCommand)
export class ChangeCaseOperatorHandler implements ICommandHandler<
  ChangeCaseOperatorCommand,
  void
> {
  constructor(
    @Inject(INVESTIGATION_CASE_REPOSITORY)
    private readonly repo: InvestigationCaseRepository,
    @Inject(SERVICE_USER_DIRECTORY)
    private readonly serviceUsers: ServiceUserDirectory,
  ) {}

  async execute(cmd: ChangeCaseOperatorCommand): Promise<void> {
    const investigationCase = await this.repo.findById(cmd.caseId);
    if (!investigationCase) throw new CaseNotFoundError(cmd.caseId);

    const isServiceManager = cmd.requester.role === UserRoleEnum.ADMIN;
    const isCurrentOperator =
      investigationCase.operatorUserId === cmd.requester.id;
    if (!isServiceManager && !isCurrentOperator) {
      throw new OperatorChangeNotAllowedError(cmd.caseId);
    }

    const designatedExists = await this.serviceUsers.exists(
      cmd.newOperatorUserId,
    );
    if (!designatedExists)
      throw new UnknownOperatorError(cmd.newOperatorUserId);

    const previousOperatorUserId = investigationCase.operatorUserId;
    investigationCase.changeOperator(cmd.newOperatorUserId);

    await this.repo.save(investigationCase, {
      eventType: AuditEventTypeEnum.CASE_OPERATOR_CHANGED,
      evidenceClass: EvidenceClassEnum.OBSERVED,
      actor: cmd.actor,
      caseId: investigationCase.id,
      payload: {
        previousOperatorUserId,
        newOperatorUserId: cmd.newOperatorUserId,
      },
    });
  }
}
