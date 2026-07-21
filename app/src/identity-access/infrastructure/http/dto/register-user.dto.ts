import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRoleEnum } from '../../../domain/user/value-objects/user-role.vo';

export class RegisterUserDto {
  @ApiProperty({
    description: 'Identity provider id (sub Keycloak)',
    example: 'a1b2c3d4-0000-0000-0000-000000000000',
  })
  @IsString()
  @IsNotEmpty()
  identityProviderId: string;

  @ApiProperty({ description: "Rôle de l'utilisateur", enum: UserRoleEnum })
  @IsEnum(UserRoleEnum)
  role: UserRoleEnum;

  @ApiProperty({ description: 'Grade', example: 'Capitaine' })
  @IsString()
  @IsNotEmpty()
  grade: string;

  @ApiProperty({ description: 'Numéro de service unique', example: 'SN-4212' })
  @IsString()
  @IsNotEmpty()
  serviceNumber: string;

  @ApiProperty({ description: 'Prénom', example: 'Jean' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ description: 'Nom', example: 'Dupont' })
  @IsString()
  @IsNotEmpty()
  lastName: string;
}
