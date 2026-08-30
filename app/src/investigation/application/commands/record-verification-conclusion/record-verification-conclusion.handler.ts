import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import {
  ID_GENERATOR,
  IdGenerator,
} from '../../../../shared/domain/ports/id-generator';
import { CaseVerification } from '../../../domain/case-verification/entity/case-verification';
import { VerificationDecision } from '../../../domain/case-verification/entity/verification-decision';
import { NotTheVerifierError } from '../../../domain/case-verification/errors/not-the-verifier.error';
import { TraceOutsideVerificationError } from '../../../domain/case-verification/errors/trace-outside-verification.error';
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
import { VerificationStatusEnum } from '../../../domain/case-verification/value-objects/verification-status.vo';
import {
  TRANSACTION_RUNNER,
  TransactionRunner,
} from '../../../../shared/domain/ports/transaction-runner';
import {
  CASE_EXPLOITATION_READER,
  CaseExploitationReader,
  ExploitedTrace,
} from '../../ports/case-exploitation.reader';
import { confrontAndClose } from '../complete-case-verification/confront-and-close';
import { RecordVerificationConclusionCommand } from './record-verification-conclusion.command';

@CommandHandler(RecordVerificationConclusionCommand)
export class RecordVerificationConclusionHandler implements ICommandHandler<
  RecordVerificationConclusionCommand,
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
    @Inject(ID_GENERATOR)
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(cmd: RecordVerificationConclusionCommand): Promise<void> {
    const verification = await this.verifications.findById(cmd.verificationId);
    if (!verification) throw new VerificationNotFoundError(cmd.verificationId);
    if (verification.verifierUserId !== cmd.requesterId) {
      throw new NotTheVerifierError(cmd.verificationId);
    }

    await this.assertCaseStillOpen(verification.caseId);
    const traces = await this.exploitation.findTraces(verification.caseId);
    if (!traces.some((trace) => trace.traceId === cmd.traceId)) {
      throw new TraceOutsideVerificationError(cmd.traceId, cmd.verificationId);
    }

    const decisions = await this.decisions.findByVerificationId(
      cmd.verificationId,
    );
    const decision = this.statedDecision(decisions, cmd);

    await this.decisions.save(decision, {
      eventType: AuditEventTypeEnum.VERIFICATION_CONCLUSION_STATED,
      evidenceClass: EvidenceClassEnum.OBSERVED,
      actor: cmd.actor,
      caseId: verification.caseId,
      traceId: cmd.traceId,
      payload: {
        verificationId: cmd.verificationId,
        traceId: cmd.traceId,
        exploitability: cmd.exploitability,
        identifiedReferencePrintId: cmd.identifiedReferencePrintId,
      },
    });

    if (verification.status !== VerificationStatusEnum.PENDING) {
      await this.reconfront(verification, traces, decisions, decision, cmd);
    }
  }

  private statedDecision(
    decisions: VerificationDecision[],
    cmd: RecordVerificationConclusionCommand,
  ): VerificationDecision {
    const existing = decisions.find(
      (candidate) => candidate.traceId === cmd.traceId,
    );
    if (existing) {
      existing.restate(cmd.exploitability, cmd.identifiedReferencePrintId);
      return existing;
    }
    return VerificationDecision.state({
      id: this.idGenerator.generate(),
      verificationId: cmd.verificationId,
      traceId: cmd.traceId,
      exploitability: cmd.exploitability,
      identifiedReferencePrintId: cmd.identifiedReferencePrintId,
    });
  }

  private reconfront(
    verification: CaseVerification,
    traces: ExploitedTrace[],
    decisions: VerificationDecision[],
    decision: VerificationDecision,
    cmd: RecordVerificationConclusionCommand,
  ): Promise<void> {
    const confronted = decisions.includes(decision)
      ? decisions
      : [...decisions, decision];
    return confrontAndClose(verification, traces, confronted, cmd.actor, {
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
