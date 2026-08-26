import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRoleEnum } from '../../../identity-access/domain/user/value-objects/user-role.vo';

export class CreateOrganizationUserDto {
  @ApiProperty({ description: 'Adresse électronique', example: 'chef@lyon.fr' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Prénom', example: 'Jean' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  firstName!: string;

  @ApiProperty({ description: 'Nom', example: 'Dupont' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  lastName!: string;

  @ApiProperty({ description: 'Rôle dans le service', enum: UserRoleEnum })
  @IsEnum(UserRoleEnum)
  role!: UserRoleEnum;

  @ApiProperty({ description: 'Grade', example: 'Capitaine' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  grade!: string;

  @ApiProperty({
    description: 'Matricule, unique dans le service',
    example: 'SN-4212',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  serviceNumber!: string;
}
