import {
  Equals,
  IsEnum,
  IsHexColor,
  IsInt,
  IsPositive,
  Max,
  Min,
} from 'class-validator';
import { AnnotationSettingsDto } from './annotation-settings.dto';
import { MinutiaTypeEnum } from '../../../../../shared/domain/forensics/minutiae';

export class MinutiaSettingsDto extends AnnotationSettingsDto {
  @Equals('minutia')
  type: 'minutia';

  @IsInt()
  x: number;

  @IsInt()
  y: number;

  @IsInt()
  @IsPositive()
  radius: number;

  @IsHexColor()
  color: string;

  /** Convention : zéro pointe vers le haut, l'angle croît dans le sens horaire. */
  @IsInt()
  @Min(0)
  @Max(359)
  angle: number;

  @IsEnum(MinutiaTypeEnum)
  minutiaType: MinutiaTypeEnum;
}
