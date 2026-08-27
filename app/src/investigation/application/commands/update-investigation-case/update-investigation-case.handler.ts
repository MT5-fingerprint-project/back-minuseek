import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UserRoleEnum } from '../../../../identity-access/domain/user/value-objects/user-role.vo';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { AuditEventDraft } from '../../../../shared/domain/ports/audit-trail.port';
import {
  CaseCorrection,
  InvestigationCase,
} from '../../../domain/investigation-case/entity/investigation-case';
import { CaseClosedError } from '../../../domain/investigation-case/errors/case-closed.error';
import { CaseNotFoundError } from '../../../domain/investigation-case/errors/case-not-found.error';
import { DisabledOperatorError } from '../../../domain/investigation-case/errors/disabled-operator.error';
import { OperatorChangeNotAllowedError } from '../../../domain/investigation-case/errors/operator-change-not-allowed.error';
import { UnknownOperatorError } from '../../../domain/investigation-case/errors/unknown-operator.error';
import {
  INVESTIGATION_CASE_REPOSITORY,
  InvestigationCaseRepository,
} from '../../../domain/investigation-case/repository/investigation-case.repository';
import { InvestigationCaseStatusEnum } from '../../../domain/investigation-case/value-objects/investigation-case-status.vo';
import {
  DesignatableServiceUser,
  SERVICE_USER_DIRECTORY,
  ServiceUserDirectory,
  serviceUserName,
} from '../../ports/service-user.directory';
import {
  CaseUpdate,
  CaseUpdateRequester,
  UpdateInvestigationCaseCommand,
} from './update-investigation-case.command';

/** Ce qui a été envoyé, et rien de plus : un champ absent reste absent, un champ
 * à `null` est vidé. */
function correctionOf(changes: CaseUpdate): CaseCorrection | null {
  const correction: CaseCorrection = {};
  if (changes.pvNumber !== undefined) correction.pvNumber = changes.pvNumber;
  if (changes.description !== undefined)
    correction.description = changes.description;
  return Object.keys(correction).length > 0 ? correction : null;
}

@CommandHandler(UpdateInvestigationCaseCommand)
export class UpdateInvestigationCaseHandler implements ICommandHandler<
  UpdateInvestigationCaseCommand,
  void
> {
  constructor(
    @Inject(INVESTIGATION_CASE_REPOSITORY)
    private readonly repo: InvestigationCaseRepository,
    @Inject(SERVICE_USER_DIRECTORY)
    private readonly serviceUsers: ServiceUserDirectory,
  ) {}

  async execute(cmd: UpdateInvestigationCaseCommand): Promise<void> {
    const investigationCase = await this.repo.findById(cmd.caseId);
    if (!investigationCase) throw new CaseNotFoundError(cmd.caseId);

    const correction = correctionOf(cmd.changes);
    const newOperatorUserId = cmd.changes.operatorUserId ?? null;
    // Un appel sans aucun champ ne change rien
    if (correction === null && newOperatorUserId === null) return;

    if (investigationCase.status === InvestigationCaseStatusEnum.CLOSED) {
      throw new CaseClosedError(cmd.caseId);
    }
    let designatedOperator: DesignatableServiceUser | null = null;
    if (newOperatorUserId !== null) {
      this.refuseHandoverBy(cmd.requester, investigationCase);
      designatedOperator = await this.designatedOrRefuse(newOperatorUserId);
    }

    const acts: AuditEventDraft[] = [];
    if (correction !== null) {
      investigationCase.correct(correction);
      acts.push({
        eventType: AuditEventTypeEnum.CASE_UPDATED,
        evidenceClass: EvidenceClassEnum.OBSERVED,
        actor: cmd.actor,
        caseId: investigationCase.id,
        payload: { changes: correction },
      });
    }
    if (newOperatorUserId !== null && designatedOperator !== null) {
      const previousOperatorUserId = investigationCase.operatorUserId;
      const previousOperator = previousOperatorUserId
        ? await this.serviceUsers.findById(previousOperatorUserId)
        : null;
      investigationCase.changeOperator(newOperatorUserId);
      acts.push({
        eventType: AuditEventTypeEnum.CASE_OPERATOR_CHANGED,
        evidenceClass: EvidenceClassEnum.OBSERVED,
        actor: cmd.actor,
        caseId: investigationCase.id,
        payload: {
          previousOperatorUserId,
          previousOperatorName: previousOperator
            ? serviceUserName(previousOperator)
            : null,
          newOperatorUserId,
          newOperatorName: serviceUserName(designatedOperator),
        },
      });
    }

    await this.repo.save(investigationCase, ...acts);
  }

  private refuseHandoverBy(
    requester: CaseUpdateRequester,
    investigationCase: InvestigationCase,
  ): void {
    const isServiceManager = requester.role === UserRoleEnum.ADMIN;
    const isCurrentOperator = investigationCase.operatorUserId === requester.id;
    if (!isServiceManager && !isCurrentOperator) {
      throw new OperatorChangeNotAllowedError(investigationCase.id);
    }
  }

  private async designatedOrRefuse(
    operatorUserId: string,
  ): Promise<DesignatableServiceUser> {
    const designated = await this.serviceUsers.findById(operatorUserId);
    if (!designated) throw new UnknownOperatorError(operatorUserId);
    if (designated.disabled) throw new DisabledOperatorError(operatorUserId);
    return designated;
  }
}
