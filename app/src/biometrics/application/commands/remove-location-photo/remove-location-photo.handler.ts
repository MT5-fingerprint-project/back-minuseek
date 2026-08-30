import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { assertCaseAcceptsWork } from '../../../domain/case-work-window';
import { TraceNotFoundError } from '../../../domain/trace/errors/trace-not-found.error';
import {
  TRACE_REPOSITORY,
  TraceRepository,
} from '../../../domain/trace/repository/trace.repository';
import { TraceLocationPhotoNotFoundError } from '../../../domain/trace-location-photo/errors/trace-location-photo-not-found.error';
import {
  TRACE_LOCATION_PHOTO_REPOSITORY,
  TraceLocationPhotoRepository,
} from '../../../domain/trace-location-photo/repository/trace-location-photo.repository';
import { withdrawalDetailOf } from '../../../domain/withdrawal/withdrawal.vo';
import { CASE_STATUS, CaseStatusPort } from '../../ports/case-status.port';
import { RemoveLocationPhotoCommand } from './remove-location-photo.command';

@CommandHandler(RemoveLocationPhotoCommand)
export class RemoveLocationPhotoHandler implements ICommandHandler<
  RemoveLocationPhotoCommand,
  void
> {
  constructor(
    @Inject(TRACE_REPOSITORY)
    private readonly traces: TraceRepository,
    @Inject(TRACE_LOCATION_PHOTO_REPOSITORY)
    private readonly locationPhotos: TraceLocationPhotoRepository,
    @Inject(CASE_STATUS)
    private readonly caseStatus: CaseStatusPort,
  ) {}

  async execute(cmd: RemoveLocationPhotoCommand): Promise<void> {
    const motiveDetail = withdrawalDetailOf(cmd.motive, cmd.motiveDetail);

    const trace = await this.traces.findById(cmd.traceId);
    if (!trace) {
      throw new TraceNotFoundError(cmd.traceId);
    }

    assertCaseAcceptsWork(
      trace.caseId,
      await this.caseStatus.findStatus(trace.caseId),
    );

    const photo = await this.locationPhotos.findByTraceId(cmd.traceId);
    if (photo === null) {
      throw new TraceLocationPhotoNotFoundError(cmd.traceId);
    }

    // L'objet stocké n'est jamais détruit : l'empreinte inscrite au journal
    // continue de désigner des octets qui existent.
    await this.locationPhotos.delete(photo.id, {
      eventType: AuditEventTypeEnum.LOCATION_PHOTO_DELETED,
      evidenceClass: EvidenceClassEnum.OBSERVED,
      actor: cmd.actor,
      caseId: trace.caseId,
      traceId: trace.id,
      payload: {
        locationPhotoId: photo.id,
        storagePath: photo.path,
        fileSha256: photo.sha256,
        motive: cmd.motive,
        motiveDetail,
      },
    });
  }
}
