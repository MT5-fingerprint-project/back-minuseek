import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class DeclareCaseExpertiseDto {
  @ApiProperty({
    description: 'Texte du serment, archivé mot pour mot',
    maxLength: 5000,
    example:
      "Je soussigné Julien Marchand, brigadier-chef en fonction au SRPTS de Paris, expert désigné pour procéder aux opérations prévues dans l'ordonnance de commission d'expert, prête serment de bien et fidèlement la remplir en mon honneur et conscience.",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  oathStatement!: string;

  @ApiProperty({
    description: "Juridiction qui a commis l'expert",
    maxLength: 200,
    example: 'Tribunal judiciaire de Paris',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  courtReference!: string;
}
