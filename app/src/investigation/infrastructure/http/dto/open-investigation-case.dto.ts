import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class OpenInvestigationCaseDto {
  @IsString()
  @IsNotEmpty()
  caseNumber: string;

  @IsString()
  @IsNotEmpty()
  pvNumber: string;

  @IsString()
  @IsOptional()
  description?: string;
}
