import { IsUUID } from 'class-validator';

export class ListMinutiaPairsDto {
  @IsUUID()
  referencePrintId: string;
}
