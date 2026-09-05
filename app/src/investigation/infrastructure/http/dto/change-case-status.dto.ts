import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { InvestigationCaseStatusEnum } from '../../../domain/investigation-case/value-objects/investigation-case-status.vo';

export const SELECTABLE_CASE_STATUSES = [
  InvestigationCaseStatusEnum.IN_PROGRESS,
  InvestigationCaseStatusEnum.UNDER_REVIEW,
] as const;

export class ChangeCaseStatusDto {
  @ApiProperty({
    description: "Statut de travail visé pour l'affaire",
    enum: SELECTABLE_CASE_STATUSES,
    example: InvestigationCaseStatusEnum.IN_PROGRESS,
  })
  @IsIn(SELECTABLE_CASE_STATUSES)
  status!: (typeof SELECTABLE_CASE_STATUSES)[number];
}
