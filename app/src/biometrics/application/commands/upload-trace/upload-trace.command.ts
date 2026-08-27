import type { CaseRequester } from '../../../../access/application/case-access.service';
import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';
import { CaptureMetadataProps } from '../../../domain/trace/value-objects/capture-metadata.vo';
import { CaptureQualityProps } from '../../../domain/trace/value-objects/capture-quality.vo';

export class UploadTraceCommand {
  constructor(
    public readonly actor: AuditActor,
    public readonly requester: CaseRequester | null,
    public readonly fileBuffer: Buffer,
    public readonly caseId: string,
    public readonly capture?: CaptureMetadataProps,
    public readonly captureQuality?: CaptureQualityProps,
  ) {}
}
