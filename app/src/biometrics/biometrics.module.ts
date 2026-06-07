import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { UploadReferencePrintHandler } from './application/commands/upload-reference-print/upload-reference-print.handler';
import { UploadTraceHandler } from './application/commands/upload-trace/upload-trace.handler';
import { IMAGE_STORAGE } from './application/ports/image-storage.port';
import { REFERENCE_PRINT_REPOSITORY } from './domain/reference-print/repository/reference-print.repository';
import { TRACE_REPOSITORY } from './domain/trace/repository/trace.repository';
import { BiometricsController } from './infrastructure/http/biometrics.controller';
import { PrismaReferencePrintRepository } from './infrastructure/persistence/prisma-reference-print.repository';
import { PrismaTraceRepository } from './infrastructure/persistence/prisma-trace.repository';
import { LocalImageStorageAdapter } from './infrastructure/storage/local-image-storage.adapter';

@Module({
  imports: [CqrsModule],
  controllers: [BiometricsController],
  providers: [
    UploadTraceHandler,
    UploadReferencePrintHandler,
    {
      provide: TRACE_REPOSITORY,
      useClass: PrismaTraceRepository,
    },
    {
      provide: REFERENCE_PRINT_REPOSITORY,
      useClass: PrismaReferencePrintRepository,
    },
    {
      provide: IMAGE_STORAGE,
      useClass: LocalImageStorageAdapter,
    },
  ],
})
export class BiometricsModule {}
