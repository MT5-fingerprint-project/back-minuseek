import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UserRoleEnum } from '../../../../identity-access/domain/user/value-objects/user-role.vo';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import {
  ID_GENERATOR,
  IdGenerator,
} from '../../../../shared/domain/ports/id-generator';
import { CaseVerification } from '../../../domain/case-verification/entity/case-verification';
import { CaseVerificationNotAllowedError } from '../../../domain/case-verification/errors/case-verification-not-allowed.error';
import { SelfVerificationError } from '../../../domain/case-verification/errors/self-verification.error';
import { ServiceManagerAsVerifierError } from '../../../domain/case-verification/errors/service-manager-as-verifier.error';
import { VerificationAlreadyPendingError } from '../../../domain/case-verification/errors/verification-already-pending.error';
import {
  CASE_VERIFICATION_REPOSITORY,
  CaseVerificationRepository,
} from '../../../domain/case-verification/repository/case-verification.repository';
import { InvestigationCase } from '../../../domain/investigation-case/entity/investigation-case';
import { CaseClosedError } from '../../../domain/investigation-case/errors/case-closed.error';
import { CaseNotFoundError } from '../../../domain/investigation-case/errors/case-not-found.error';
import { DisabledOperatorError } from '../../../domain/investigation-case/errors/disabled-operator.error';
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
  RequestCaseVerificationCommand,
  VerificationRequester,
} from './request-case-verification.command';

@CommandHandler(RequestCaseVerificationCommand)
export class RequestCaseVerificationHandler implements ICommandHandler<
  RequestCaseVerificationCommand,
  string
> {
  constructor(
    @Inject(INVESTIGATION_CASE_REPOSITORY)
    private readonly cases: InvestigationCaseRepository,
    @Inject(CASE_VERIFICATION_REPOSITORY)
    private readonly verifications: CaseVerificationRepository,
    @Inject(SERVICE_USER_DIRECTORY)
    private readonly serviceUsers: ServiceUserDirectory,
    @Inject(ID_GENERATOR)
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(cmd: RequestCaseVerificationCommand): Promise<string> {
    const investigationCase = await this.cases.findById(cmd.caseId);
    if (!investigationCase) throw new CaseNotFoundError(cmd.caseId);

    this.refuseRequestBy(cmd.requester, investigationCase);
    if (investigationCase.status === InvestigationCaseStatusEnum.CLOSED) {
      throw new CaseClosedError(cmd.caseId);
    }
    if (investigationCase.operatorUserId === cmd.verifierUserId) {
      throw new SelfVerificationError(cmd.caseId);
    }
    const verifier = await this.designatedOrRefuse(cmd.verifierUserId);
    const alreadyPending = await this.verifications.hasPendingFor(
      cmd.caseId,
      cmd.verifierUserId,
    );
    if (alreadyPending) {
      throw new VerificationAlreadyPendingError(cmd.caseId, cmd.verifierUserId);
    }

    const id = this.idGenerator.generate();
    await this.verifications.save(
      CaseVerification.request({
        id,
        caseId: cmd.caseId,
        verifierUserId: cmd.verifierUserId,
        requestedByUserId: cmd.requester.id,
      }),
      {
        eventType: AuditEventTypeEnum.CASE_VERIFICATION_REQUESTED,
        evidenceClass: EvidenceClassEnum.OBSERVED,
        actor: cmd.actor,
        caseId: cmd.caseId,
        payload: {
          verificationId: id,
          verifierUserId: cmd.verifierUserId,
          verifierName: serviceUserName(verifier),
          requestedByUserId: cmd.requester.id,
        },
      },
    );
    return id;
  }

  private refuseRequestBy(
    requester: VerificationRequester,
    investigationCase: InvestigationCase,
  ): void {
    const isServiceManager = requester.role === UserRoleEnum.ADMIN;
    const isCaseOperator = investigationCase.operatorUserId === requester.id;
    if (!isServiceManager && !isCaseOperator) {
      throw new CaseVerificationNotAllowedError(investigationCase.id);
    }
  }

  private async designatedOrRefuse(
    verifierUserId: string,
  ): Promise<DesignatableServiceUser> {
    const designated = await this.serviceUsers.findById(verifierUserId);
    if (!designated) throw new UnknownOperatorError(verifierUserId);
    if (designated.disabled) throw new DisabledOperatorError(verifierUserId);
    if (designated.role === (UserRoleEnum.ADMIN as string)) {
      throw new ServiceManagerAsVerifierError(verifierUserId);
    }
    return designated;
  }
}
