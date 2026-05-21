import { Module } from '@nestjs/common';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { UploadTraceHandler } from './application/commands/upload-trace/upload-trace.handler';
import type { TraceIdGenerator } from './application/ports/trace-id-generator.port';
import type { TraceStoragePort } from './application/ports/trace-storage.port';
import type { TraceRepository } from './domain/trace.repository';
import { TracesController } from './infrastructure/http/traces.controller';
import { UuidTraceIdGenerator } from './infrastructure/identity/uuid-trace-id-generator.adapter';
import { PrismaTraceRepository } from './infrastructure/persistence/prisma-trace.repository';
import { LocalTraceStorageAdapter } from './infrastructure/storage/local-trace-storage.adapter';

const TRACE_REPOSITORY = 'TraceRepository';
const TRACE_STORAGE = 'TraceStorage';
const TRACE_ID_GENERATOR = 'TraceIdGenerator';

@Module({
  controllers: [TracesController],
  providers: [
    PrismaService,
    { provide: TRACE_REPOSITORY, useClass: PrismaTraceRepository },
    { provide: TRACE_STORAGE, useClass: LocalTraceStorageAdapter },
    { provide: TRACE_ID_GENERATOR, useClass: UuidTraceIdGenerator },
    {
      provide: UploadTraceHandler,
      useFactory: (
        repository: TraceRepository,
        storage: TraceStoragePort,
        idGenerator: TraceIdGenerator,
      ) => new UploadTraceHandler(repository, storage, idGenerator),
      inject: [TRACE_REPOSITORY, TRACE_STORAGE, TRACE_ID_GENERATOR],
    },
  ],
})
export class BiometricsModule {}
