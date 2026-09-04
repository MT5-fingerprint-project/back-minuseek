import { IsUUID } from 'class-validator';

export class CreateMinutiaPairDto {
  @IsUUID()
  referencePrintId: string;

  @IsUUID()
  traceMinutiaLayerId: string;

  @IsUUID()
  referenceMinutiaLayerId: string;
}
