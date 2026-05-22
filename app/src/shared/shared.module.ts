import { Global, Module } from '@nestjs/common';
import { UuidGenerator } from './infrastructure/uuid-generator';
import { ID_GENERATOR } from './domain/ports/id-generator';

@Global()
@Module({
  providers: [{ provide: ID_GENERATOR, useClass: UuidGenerator }],
  exports: [{ provide: ID_GENERATOR, useClass: UuidGenerator }],
})
export class SharedModule {}
