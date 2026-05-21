import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BiometricsModule } from './biometrics/biometrics.module';

@Module({
  imports: [BiometricsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
