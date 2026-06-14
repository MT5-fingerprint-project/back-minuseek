import {
  ArrayMinSize,
  Equals,
  IsArray,
  IsHexColor,
  IsNumber,
  IsPositive,
} from 'class-validator';

export class PencilSettingsDto {
  @Equals('pencil')
  type: 'pencil';

  @IsArray()
  @ArrayMinSize(4) // au moins 2 points (x,y x2) pour former un trait
  @IsNumber({}, { each: true })
  points: number[];

  @IsHexColor()
  color: string;

  @IsNumber()
  @IsPositive()
  strokeWidth: number;
}
