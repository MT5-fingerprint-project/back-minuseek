import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';
import { CaptureMetadataProps } from '../../../domain/trace/value-objects/capture-metadata.vo';

export class UploadTraceCommand {
  constructor(
    public readonly actor: AuditActor,
    public readonly fileBuffer: Buffer,
    public readonly originalName: string,
    public readonly mimeType: string,
    public readonly caseId: string,
    public readonly capture?: CaptureMetadataProps,
  ) {}
}
