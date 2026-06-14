import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class FilterSettingsDto {
  @IsString()
  @IsNotEmpty()
  filterKey: string;

  @IsNumber()
  value: number;
}
