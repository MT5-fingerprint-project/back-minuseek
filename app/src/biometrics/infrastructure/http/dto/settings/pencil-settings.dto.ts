import {
  ArrayMinSize,
  Equals,
  IsArray,
  IsHexColor,
  IsInt,
  IsNumber,
  IsPositive,
} from 'class-validator';
import { AnnotationSettingsDto } from './annotation-settings.dto';

export class PencilSettingsDto extends AnnotationSettingsDto {
  @Equals('pencil')
  type: 'pencil';

  @IsArray()
  @ArrayMinSize(4) // au moins 2 points (x,y x2) pour former un trait
  @IsInt({ each: true })
  points: number[];

  @IsHexColor()
  color: string;

  // Reste flottant (contrairement aux coordonnées) : l'arrondir épaissirait
  // visiblement le trait à l'écran (ex. 1.5 -> 2px), cf. contrat front L5-7.
  @IsNumber()
  @IsPositive()
  strokeWidth: number;
}
