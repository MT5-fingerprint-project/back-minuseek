import { Global, Module } from '@nestjs/common';
import { UuidGenerator } from './infrastructure/uuid-generator';
import { StructuredLogger } from './infrastructure/logging/structured-logger';
import { ID_GENERATOR } from './domain/ports/id-generator';

@Global()
@Module({
  providers: [
    { provide: ID_GENERATOR, useClass: UuidGenerator },
    StructuredLogger,
  ],
  exports: [
    { provide: ID_GENERATOR, useClass: UuidGenerator },
    StructuredLogger,
  ],
})
export class SharedModule {}
