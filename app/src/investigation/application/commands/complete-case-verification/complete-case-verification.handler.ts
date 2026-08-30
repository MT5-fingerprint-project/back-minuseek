import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IncompleteVerificationError } from '../../../domain/case-verification/errors/incomplete-verification.error';
import { NotTheVerifierError } from '../../../domain/case-verification/errors/not-the-verifier.error';
import { VerificationNotFoundError } from '../../../domain/case-verification/errors/verification-not-found.error';
import { CaseClosedError } from '../../../domain/investigation-case/errors/case-closed.error';
import {
  INVESTIGATION_CASE_REPOSITORY,
  InvestigationCaseRepository,
} from '../../../domain/investigation-case/repository/investigation-case.repository';
import { InvestigationCaseStatusEnum } from '../../../domain/investigation-case/value-objects/investigation-case-status.vo';
import {
  CASE_VERIFICATION_REPOSITORY,
  CaseVerificationRepository,
} from '../../../domain/case-verification/repository/case-verification.repository';
import {
  VERIFICATION_DECISION_REPOSITORY,
  VerificationDecisionRepository,
} from '../../../domain/case-verification/repository/verification-decision.repository';
import {
  TRANSACTION_RUNNER,
  TransactionRunner,
} from '../../../../shared/domain/ports/transaction-runner';
import {
  CASE_EXPLOITATION_READER,
  CaseExploitationReader,
} from '../../ports/case-exploitation.reader';
import { CompleteCaseVerificationCommand } from './complete-case-verification.command';
import { confrontAndClose } from './confront-and-close';

@CommandHandler(CompleteCaseVerificationCommand)
export class CompleteCaseVerificationHandler implements ICommandHandler<
  CompleteCaseVerificationCommand,
  void
> {
  constructor(
    @Inject(CASE_VERIFICATION_REPOSITORY)
    private readonly verifications: CaseVerificationRepository,
    @Inject(VERIFICATION_DECISION_REPOSITORY)
    private readonly decisions: VerificationDecisionRepository,
    @Inject(CASE_EXPLOITATION_READER)
    private readonly exploitation: CaseExploitationReader,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactions: TransactionRunner,
    @Inject(INVESTIGATION_CASE_REPOSITORY)
    private readonly cases: InvestigationCaseRepository,
  ) {}

  async execute(cmd: CompleteCaseVerificationCommand): Promise<void> {
    const verification = await this.verifications.findById(cmd.verificationId);
    if (!verification) throw new VerificationNotFoundError(cmd.verificationId);
    if (verification.verifierUserId !== cmd.requesterId) {
      throw new NotTheVerifierError(cmd.verificationId);
    }

    await this.assertCaseStillOpen(verification.caseId);
    const traces = await this.exploitation.findTraces(verification.caseId);
    const decisions = await this.decisions.findByVerificationId(
      cmd.verificationId,
    );
    const missing = traces.filter(
      (trace) =>
        !decisions.some((decision) => decision.traceId === trace.traceId),
    );
    if (missing.length > 0) {
      throw new IncompleteVerificationError(missing.length);
    }

    await confrontAndClose(verification, traces, decisions, cmd.actor, {
      verifications: this.verifications,
      decisions: this.decisions,
      transactions: this.transactions,
    });
  }

  private async assertCaseStillOpen(caseId: string): Promise<void> {
    const investigationCase = await this.cases.findById(caseId);
    if (investigationCase?.status === InvestigationCaseStatusEnum.CLOSED) {
      throw new CaseClosedError(caseId);
    }
  }
}
