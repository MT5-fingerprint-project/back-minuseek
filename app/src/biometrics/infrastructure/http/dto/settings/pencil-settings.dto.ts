import {
  ArrayMinSize,
  Equals,
  IsArray,
  IsHexColor,
  IsInt,
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

  @IsInt()
  @IsPositive()
  strokeWidth: number;
}
