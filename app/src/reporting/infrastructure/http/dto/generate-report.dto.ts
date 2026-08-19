import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { ReportTypeName } from '../../../domain/report/entity/report';

const REPORT_TYPES: ReportTypeName[] = ['TECHNICAL', 'TRACEABILITY'];

export class GenerateReportDto {
  @ApiProperty({
    description:
      'TECHNICAL = rapport technique narratif ; TRACEABILITY = annexe de traçabilité',
    enum: REPORT_TYPES,
  })
  @IsIn(REPORT_TYPES)
  type!: ReportTypeName;
}
