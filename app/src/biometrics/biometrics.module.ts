import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { UploadReferencePrintHandler } from './application/commands/upload-reference-print/upload-reference-print.handler';
import { UploadTraceHandler } from './application/commands/upload-trace/upload-trace.handler';
import { DeleteTraceHandler } from './application/commands/delete-trace/delete-trace.handler';
import { DeleteReferencePrintHandler } from './application/commands/delete-reference-print/delete-reference-print.handler';
import { ListTracesHandler } from './application/queries/list-traces/list-traces.handler';
import { ListReferencePrintsHandler } from './application/queries/list-reference-prints/list-reference-prints.handler';
import { CreateLayerHandler } from './application/commands/create-layer/create-layer.handler';
import { UpdateLayerHandler } from './application/commands/update-layer/update-layer.handler';
import { DeleteLayerHandler } from './application/commands/delete-layer/delete-layer.handler';
import { ListLayersHandler } from './application/queries/list-layers/list-layers.handler';
import { IMAGE_STORAGE } from './application/ports/image-storage.port';
import { TRACE_READER } from './application/queries/list-traces/trace.reader';
import { REFERENCE_PRINT_READER } from './application/queries/list-reference-prints/reference-print.reader';
import { LAYER_READER } from './application/queries/list-layers/layer.reader';
import { REFERENCE_PRINT_REPOSITORY } from './domain/reference-print/repository/reference-print.repository';
import { TRACE_REPOSITORY } from './domain/trace/repository/trace.repository';
import { LAYER_REPOSITORY } from './domain/layer/repository/layer.repository';
import { BiometricsController } from './infrastructure/http/biometrics.controller';
import { LayersController } from './infrastructure/http/layers.controller';
import { PrismaReferencePrintRepository } from './infrastructure/persistence/prisma-reference-print.repository';
import { PrismaTraceRepository } from './infrastructure/persistence/prisma-trace.repository';
import { PrismaTraceReader } from './infrastructure/persistence/prisma-trace.reader';
import { PrismaReferencePrintReader } from './infrastructure/persistence/prisma-reference-print.reader';
import { PrismaLayerRepository } from './infrastructure/persistence/prisma-layer.repository';
import { PrismaLayerReader } from './infrastructure/persistence/prisma-layer.reader';
import { GcsImageStorageAdapter } from './infrastructure/storage/gcs-image-storage.adapter';
import { InMemoryImageStorageAdapter } from './infrastructure/storage/in-memory-image-storage.adapter';

@Module({
  imports: [CqrsModule],
  controllers: [BiometricsController, LayersController],
  providers: [
    UploadTraceHandler,
    UploadReferencePrintHandler,
    DeleteTraceHandler,
    DeleteReferencePrintHandler,
    ListTracesHandler,
    ListReferencePrintsHandler,
    CreateLayerHandler,
    UpdateLayerHandler,
    DeleteLayerHandler,
    ListLayersHandler,
    { provide: TRACE_REPOSITORY, useClass: PrismaTraceRepository },
    {
      provide: REFERENCE_PRINT_REPOSITORY,
      useClass: PrismaReferencePrintRepository,
    },
    { provide: LAYER_REPOSITORY, useClass: PrismaLayerRepository },
    { provide: TRACE_READER, useClass: PrismaTraceReader },
    { provide: REFERENCE_PRINT_READER, useClass: PrismaReferencePrintReader },
    { provide: LAYER_READER, useClass: PrismaLayerReader },
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
  ],
})
export class BiometricsModule {}
