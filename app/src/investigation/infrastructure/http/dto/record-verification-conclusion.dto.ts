import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID, ValidateIf } from 'class-validator';
import { VerificationExploitabilityEnum } from '../../../domain/case-verification/value-objects/verification-exploitability.vo';

export class RecordVerificationConclusionDto {
  @ApiProperty({
    description: "Ce que le vérificateur déclare de l'exploitabilité",
    enum: VerificationExploitabilityEnum,
  })
  @IsEnum(VerificationExploitabilityEnum)
  exploitability!: VerificationExploitabilityEnum;

  @ApiProperty({
    description:
      "Empreinte de référence identifiée par le vérificateur ; `null` quand il n'identifie rien",
    required: false,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf(
    (dto: RecordVerificationConclusionDto) =>
      dto.identifiedReferencePrintId !== null,
  )
  @IsUUID()
  identifiedReferencePrintId?: string | null;
}
