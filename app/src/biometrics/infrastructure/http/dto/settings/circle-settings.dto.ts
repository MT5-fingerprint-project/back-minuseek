import {
  Equals,
  IsEnum,
  IsHexColor,
  IsInt,
  IsOptional,
  IsPositive,
} from 'class-validator';
import { AnnotationSettingsDto } from './annotation-settings.dto';
import { MinutiaTypeEnum } from '../../../../../shared/domain/forensics/minutiae';

export class CircleSettingsDto extends AnnotationSettingsDto {
  @Equals('circle')
  type: 'circle';

  @IsInt()
  x: number;

  @IsInt()
  y: number;

  @IsInt()
  @IsPositive()
  radius: number;

  @IsHexColor()
  color: string;

  /** Absent des points posés avant l'ajout du type : ils valent UNDETERMINED à la lecture. */
  @IsOptional()
  @IsEnum(MinutiaTypeEnum)
  minutiaType?: MinutiaTypeEnum;
}
