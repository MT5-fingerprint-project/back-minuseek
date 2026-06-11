import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { UploadReferencePrintHandler } from './application/commands/upload-reference-print/upload-reference-print.handler';
import { UploadTraceHandler } from './application/commands/upload-trace/upload-trace.handler';
import { DeleteTraceHandler } from './application/commands/delete-trace/delete-trace.handler';
import { DeleteReferencePrintHandler } from './application/commands/delete-reference-print/delete-reference-print.handler';
import { ListTracesHandler } from './application/queries/list-traces/list-traces.handler';
import { ListReferencePrintsHandler } from './application/queries/list-reference-prints/list-reference-prints.handler';
import { IMAGE_STORAGE } from './application/ports/image-storage.port';
import { TRACE_READER } from './application/queries/list-traces/trace.reader';
import { REFERENCE_PRINT_READER } from './application/queries/list-reference-prints/reference-print.reader';
import { REFERENCE_PRINT_REPOSITORY } from './domain/reference-print/repository/reference-print.repository';
import { TRACE_REPOSITORY } from './domain/trace/repository/trace.repository';
import { BiometricsController } from './infrastructure/http/biometrics.controller';
import { PrismaReferencePrintRepository } from './infrastructure/persistence/prisma-reference-print.repository';
import { PrismaTraceRepository } from './infrastructure/persistence/prisma-trace.repository';
import { PrismaTraceReader } from './infrastructure/persistence/prisma-trace.reader';
import { PrismaReferencePrintReader } from './infrastructure/persistence/prisma-reference-print.reader';
import { LocalImageStorageAdapter } from './infrastructure/storage/local-image-storage.adapter';

@Module({
  imports: [CqrsModule],
  controllers: [BiometricsController],
  providers: [
    UploadTraceHandler,
    UploadReferencePrintHandler,
    DeleteTraceHandler,
    DeleteReferencePrintHandler,
    ListTracesHandler,
    ListReferencePrintsHandler,
    {
      provide: TRACE_REPOSITORY,
      useClass: PrismaTraceRepository,
    },
    {
      provide: REFERENCE_PRINT_REPOSITORY,
      useClass: PrismaReferencePrintRepository,
    },
    {
      provide: TRACE_READER,
      useClass: PrismaTraceReader,
    },
    {
      provide: REFERENCE_PRINT_READER,
      useClass: PrismaReferencePrintReader,
    },
    {
      provide: IMAGE_STORAGE,
      useClass: LocalImageStorageAdapter,
    },
  ],
})
export class BiometricsModule {}
