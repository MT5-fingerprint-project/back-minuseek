import { Equals, IsHexColor, IsInt, IsPositive } from 'class-validator';
import { AnnotationSettingsDto } from './annotation-settings.dto';

export class CircleArrowSettingsDto extends AnnotationSettingsDto {
  @Equals('circleArrow')
  type: 'circleArrow';

  @IsInt()
  x: number;

  @IsInt()
  y: number;

  @IsInt()
  @IsPositive()
  radius: number;

  @IsHexColor()
  color: string;

  @IsInt()
  arrowEndX: number;

  @IsInt()
  arrowEndY: number;
}
