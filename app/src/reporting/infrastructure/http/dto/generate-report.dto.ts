import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import {
  JournalDetailName,
  ReportTypeName,
} from '../../../domain/report/entity/report';

const REPORT_TYPES: ReportTypeName[] = ['TECHNICAL', 'TRACEABILITY'];
const JOURNAL_DETAILS: JournalDetailName[] = ['SUMMARY', 'FULL'];

export class GenerateReportDto {
  @ApiProperty({
    description:
      'TECHNICAL = rapport technique narratif ; TRACEABILITY = annexe de traçabilité',
    enum: REPORT_TYPES,
  })
  @IsIn(REPORT_TYPES)
  type!: ReportTypeName;

  @ApiPropertyOptional({
    description:
      "SUMMARY = annexe C résumée (défaut) ; FULL = journal détaillé, un réglage d'image par ligne",
    enum: JOURNAL_DETAILS,
  })
  @IsOptional()
  @IsIn(JOURNAL_DETAILS)
  journalDetail?: JournalDetailName;
}
