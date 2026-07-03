import { Module } from '@nestjs/common';
import { DataProxyController } from './infrastructure/http/data-proxy.controller';

@Module({
  controllers: [DataProxyController],
})
export class DataProxyModule {}
