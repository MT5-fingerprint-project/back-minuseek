import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TraceNotFoundError } from '../../../domain/trace/errors/trace-not-found.error';
import {
  TRACE_REPOSITORY,
  TraceRepository,
} from '../../../domain/trace/repository/trace.repository';
import {
  TRACE_LOCATION_PHOTO_REPOSITORY,
  TraceLocationPhotoRepository,
} from '../../../domain/trace-location-photo/repository/trace-location-photo.repository';
import { assertCaseAcceptsWork } from '../../../domain/case-work-window';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import {
  TRANSACTION_RUNNER,
  TransactionRunner,
} from '../../../../shared/domain/ports/transaction-runner';
import { CASE_STATUS, CaseStatusPort } from '../../ports/case-status.port';
import { WithdrawTraceCommand } from './withdraw-trace.command';

@CommandHandler(WithdrawTraceCommand)
export class WithdrawTraceHandler implements ICommandHandler<
  WithdrawTraceCommand,
  void
> {
  constructor(
    @Inject(TRACE_REPOSITORY)
    private readonly repo: TraceRepository,
    @Inject(CASE_STATUS)
    private readonly caseStatus: CaseStatusPort,
    @Inject(TRACE_LOCATION_PHOTO_REPOSITORY)
    private readonly locationPhotos: TraceLocationPhotoRepository,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactions: TransactionRunner,
  ) {}

  async execute(cmd: WithdrawTraceCommand): Promise<void> {
    const trace = await this.repo.findById(cmd.id);
    if (!trace) {
      throw new TraceNotFoundError(cmd.id);
    }

    assertCaseAcceptsWork(
      trace.caseId,
      await this.caseStatus.findStatus(trace.caseId),
    );

    const locationPhoto = await this.locationPhotos.findByTraceId(trace.id);

    trace.withdraw(cmd.motive, new Date());

    await this.transactions.run(async () => {
      // L'objet stocké n'est jamais détruit : l'empreinte inscrite au journal
      // continue de désigner des octets qui existent.
      await this.repo.save(trace, {
        eventType: AuditEventTypeEnum.TRACE_DELETED,
        evidenceClass: EvidenceClassEnum.OBSERVED,
        actor: cmd.actor,
        caseId: trace.caseId,
        traceId: trace.id,
        payload: {
          traceId: trace.id,
          storagePath: trace.path,
          fileSha256: trace.sha256,
          motive: cmd.motive,
        },
      });

      // La photographie de localisation quitte le dossier avec sa trace : sa
      // ligne reste en place, et un rétablissement la ramène avec elle.
      if (locationPhoto !== null) {
        await this.locationPhotos.save(locationPhoto, {
          eventType: AuditEventTypeEnum.LOCATION_PHOTO_DELETED,
          evidenceClass: EvidenceClassEnum.OBSERVED,
          actor: cmd.actor,
          caseId: trace.caseId,
          traceId: trace.id,
          payload: {
            locationPhotoId: locationPhoto.id,
            storagePath: locationPhoto.path,
            fileSha256: locationPhoto.sha256,
            motive: cmd.motive,
          },
        });
      }
    });
  }
}
