import { Equals, IsHexColor, IsInt, IsPositive } from 'class-validator';
import { AnnotationSettingsDto } from './annotation-settings.dto';

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
}
