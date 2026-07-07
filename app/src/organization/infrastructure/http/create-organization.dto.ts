import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class CreateOrganizationDto {
  @Matches(/^[a-z0-9][a-z0-9-]{0,62}$/, {
    message: 'slug: minuscules, chiffres et tirets uniquement (63 c. max)',
  })
  slug!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  displayName!: string;
}
