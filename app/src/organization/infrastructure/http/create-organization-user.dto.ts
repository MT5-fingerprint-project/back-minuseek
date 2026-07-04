import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateOrganizationUserDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  lastName?: string;
}
