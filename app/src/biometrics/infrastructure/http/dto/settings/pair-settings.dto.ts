import { Equals, IsUUID } from 'class-validator';
import { AnnotationSettingsDto } from './annotation-settings.dto';

export class PairSettingsDto extends AnnotationSettingsDto {
  @Equals('pair')
  type: 'pair';

  @IsUUID()
  referencePrintId: string;

  @IsUUID()
  traceMinutiaId: string;

  @IsUUID()
  referenceMinutiaId: string;
}
