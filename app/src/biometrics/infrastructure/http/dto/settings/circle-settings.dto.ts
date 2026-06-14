import { Equals, IsHexColor, IsNumber, IsPositive } from 'class-validator';

export class CircleSettingsDto {
  @Equals('circle')
  type: 'circle';

  @IsNumber()
  x: number;

  @IsNumber()
  y: number;

  @IsNumber()
  @IsPositive()
  radius: number;

  @IsHexColor()
  color: string;
}
