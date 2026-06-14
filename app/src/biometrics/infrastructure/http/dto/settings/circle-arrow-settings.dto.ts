import { Equals, IsHexColor, IsNumber, IsPositive } from 'class-validator';

export class CircleArrowSettingsDto {
  @Equals('circleArrow')
  type: 'circleArrow';

  @IsNumber()
  x: number;

  @IsNumber()
  y: number;

  @IsNumber()
  @IsPositive()
  radius: number;

  @IsHexColor()
  color: string;

  @IsNumber()
  arrowEndX: number;

  @IsNumber()
  arrowEndY: number;
}
