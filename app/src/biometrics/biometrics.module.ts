import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { UploadReferencePrintHandler } from './application/commands/upload-reference-print/upload-reference-print.handler';
import { UploadTraceHandler } from './application/commands/upload-trace/upload-trace.handler';
import { WithdrawTraceHandler } from './application/commands/withdraw-trace/withdraw-trace.handler';
import { CalibrateTraceHandler } from './application/commands/calibrate-trace/calibrate-trace.handler';
import { CalibrateReferencePrintHandler } from './application/commands/calibrate-reference-print/calibrate-reference-print.handler';
import { RestoreTraceHandler } from './application/commands/restore-trace/restore-trace.handler';
import { RestoreReferencePrintHandler } from './application/commands/restore-reference-print/restore-reference-print.handler';
import { WithdrawReferencePrintHandler } from './application/commands/withdraw-reference-print/withdraw-reference-print.handler';
import { ListTracesHandler } from './application/queries/list-traces/list-traces.handler';
import { GetTraceHandler } from './application/queries/get-trace/get-trace.handler';
import { ListReferencePrintsHandler } from './application/queries/list-reference-prints/list-reference-prints.handler';
import { CreateLayerHandler } from './application/commands/create-layer/create-layer.handler';
import { UpdateLayerHandler } from './application/commands/update-layer/update-layer.handler';
import { DeleteLayerHandler } from './application/commands/delete-layer/delete-layer.handler';
import { ListLayersHandler } from './application/queries/list-layers/list-layers.handler';
import { CompareTraceHandler } from './application/commands/compare-trace/compare-trace.handler';
import { RecordHitHandler } from './application/commands/record-hit/record-hit.handler';
import { RemoveHitHandler } from './application/commands/remove-hit/remove-hit.handler';
import { ListHitsHandler } from './application/queries/list-hits/list-hits.handler';
import { IMAGE_STORAGE } from './application/ports/image-storage.port';
import { IMAGE_CONVERTER } from './application/ports/image-converter.port';
import { CASE_STATUS } from './application/ports/case-status.port';
import { TRACE_NUMBER_ALLOCATOR } from './application/ports/trace-number-allocator.port';
import { CASE_EXPERTISE } from './application/ports/case-expertise.port';
import { FAMILIAR_REFERENCE_PRINT_READER } from './application/ports/familiar-reference-print.reader';
import { FAMILIAR_PRINT_DESTRUCTION } from '../investigation/application/ports/familiar-print-destruction.port';
import { CASE_EXPLOITATION_READER } from '../investigation/application/ports/case-exploitation.reader';
import { PrismaCaseExploitationReader } from './infrastructure/persistence/prisma-case-exploitation.reader';
import { FamiliarPrintDestructionService } from './application/services/familiar-print-destruction.service';
import { PrismaFamiliarReferencePrintReader } from './infrastructure/persistence/prisma-familiar-reference-print.reader';
import { FINGERPRINT_LOCATOR } from './application/ports/fingerprint-locator.port';
import { FINGERPRINT_MATCHER } from './application/ports/fingerprint-matcher.port';
import { TRACE_READER } from './application/queries/list-traces/trace.reader';
import { REFERENCE_PRINT_READER } from './application/queries/list-reference-prints/reference-print.reader';
import { LAYER_READER } from './application/queries/list-layers/layer.reader';
import { HIT_READER } from './application/queries/list-hits/hit.reader';
import { REFERENCE_PRINT_REPOSITORY } from './domain/reference-print/repository/reference-print.repository';
import { TRACE_REPOSITORY } from './domain/trace/repository/trace.repository';
import { LAYER_REPOSITORY } from './domain/layer/repository/layer.repository';
import { MATCHING_REPOSITORY } from './domain/matching/repository/matching.repository';
import { HIT_REPOSITORY } from './domain/hit/repository/hit.repository';
import { BiometricsController } from './infrastructure/http/biometrics.controller';
import { LayersController } from './infrastructure/http/layers.controller';
import { PrismaReferencePrintRepository } from './infrastructure/persistence/prisma-reference-print.repository';
import { PrismaTraceRepository } from './infrastructure/persistence/prisma-trace.repository';
import { PrismaCaseExpertiseAdapter } from './infrastructure/persistence/prisma-case-expertise.adapter';
import { PrismaCaseStatusAdapter } from './infrastructure/persistence/prisma-case-status.adapter';
import { PrismaTraceNumberAllocatorAdapter } from './infrastructure/persistence/prisma-trace-number-allocator.adapter';
import { PrismaFingerprintLocatorAdapter } from './infrastructure/persistence/prisma-fingerprint-locator.adapter';
import { PrismaTraceReader } from './infrastructure/persistence/prisma-trace.reader';
import { PrismaReferencePrintReader } from './infrastructure/persistence/prisma-reference-print.reader';
import { PrismaLayerRepository } from './infrastructure/persistence/prisma-layer.repository';
import { PrismaLayerReader } from './infrastructure/persistence/prisma-layer.reader';
import { PrismaMatchingRepository } from './infrastructure/persistence/prisma-matching.repository';
import { PrismaHitRepository } from './infrastructure/persistence/prisma-hit.repository';
import { PrismaHitReader } from './infrastructure/persistence/prisma-hit.reader';
import { SharpImageConverterAdapter } from './infrastructure/conversion/sharp-image-converter.adapter';
import { GcsImageStorageAdapter } from './infrastructure/storage/gcs-image-storage.adapter';
import { InMemoryImageStorageAdapter } from './infrastructure/storage/in-memory-image-storage.adapter';
import { DataFingerprintMatcherAdapter } from './infrastructure/matching/data-fingerprint-matcher.adapter';
import { AuditTrailModule } from '../audit-trail/audit-trail.module';
import { AccessModule } from '../access/access.module';

@Module({
  imports: [CqrsModule, AuditTrailModule, AccessModule],
  controllers: [BiometricsController, LayersController],
  providers: [
    UploadTraceHandler,
    UploadReferencePrintHandler,
    WithdrawTraceHandler,
    WithdrawReferencePrintHandler,
    CalibrateTraceHandler,
    CalibrateReferencePrintHandler,
    RestoreTraceHandler,
    RestoreReferencePrintHandler,
    ListTracesHandler,
    GetTraceHandler,
    ListReferencePrintsHandler,
    CreateLayerHandler,
    UpdateLayerHandler,
    DeleteLayerHandler,
    ListLayersHandler,
    CompareTraceHandler,
    RecordHitHandler,
    RemoveHitHandler,
    ListHitsHandler,
    { provide: TRACE_REPOSITORY, useClass: PrismaTraceRepository },
    { provide: CASE_STATUS, useClass: PrismaCaseStatusAdapter },
    {
      provide: TRACE_NUMBER_ALLOCATOR,
      useClass: PrismaTraceNumberAllocatorAdapter,
    },
    { provide: CASE_EXPERTISE, useClass: PrismaCaseExpertiseAdapter },
    {
      provide: FINGERPRINT_LOCATOR,
      useClass: PrismaFingerprintLocatorAdapter,
    },
    {
      provide: REFERENCE_PRINT_REPOSITORY,
      useClass: PrismaReferencePrintRepository,
    },
    { provide: LAYER_REPOSITORY, useClass: PrismaLayerRepository },
    { provide: MATCHING_REPOSITORY, useClass: PrismaMatchingRepository },
    { provide: HIT_REPOSITORY, useClass: PrismaHitRepository },
    {
      provide: FAMILIAR_REFERENCE_PRINT_READER,
      useClass: PrismaFamiliarReferencePrintReader,
    },
    {
      provide: FAMILIAR_PRINT_DESTRUCTION,
      useClass: FamiliarPrintDestructionService,
    },
    {
      provide: CASE_EXPLOITATION_READER,
      useClass: PrismaCaseExploitationReader,
    },
    { provide: TRACE_READER, useClass: PrismaTraceReader },
    { provide: REFERENCE_PRINT_READER, useClass: PrismaReferencePrintReader },
    { provide: LAYER_READER, useClass: PrismaLayerReader },
    { provide: HIT_READER, useClass: PrismaHitReader },
    { provide: IMAGE_CONVERTER, useClass: SharpImageConverterAdapter },
    {
      provide: IMAGE_STORAGE,
      useFactory: (): GcsImageStorageAdapter | InMemoryImageStorageAdapter => {
        const driver = process.env.STORAGE_DRIVER ?? 'gcs';
        if (driver === 'in-memory') {
          return new InMemoryImageStorageAdapter();
        }
        if (driver !== 'gcs') {
          throw new Error(
            `Unknown STORAGE_DRIVER "${driver}" (expected gcs | in-memory)`,
          );
        }
        const bucket = process.env.GCS_BUCKET;
        if (!bucket) {
          throw new Error('STORAGE_DRIVER=gcs requires GCS_BUCKET to be set');
        }
        const ttl = Number(process.env.GCS_SIGNED_URL_TTL_SECONDS ?? 900);
        return new GcsImageStorageAdapter(bucket, ttl);
      },
    },
    {
      provide: FINGERPRINT_MATCHER,
      useFactory: (): DataFingerprintMatcherAdapter => {
        const baseUrl = process.env.DATA_API_URL;
        if (!baseUrl) {
          throw new Error('DATA_API_URL is required');
        }
        return new DataFingerprintMatcherAdapter(baseUrl);
      },
    },
  ],
  exports: [FAMILIAR_PRINT_DESTRUCTION, CASE_EXPLOITATION_READER],
})
export class BiometricsModule {}
