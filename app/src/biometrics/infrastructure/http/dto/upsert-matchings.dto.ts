import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, ValidateNested } from 'class-validator';
import { MatchingScoreDto } from './matching-score.dto';

export class UpsertMatchingsDto {
  @ApiProperty({
    description:
      'Scores de correspondance de la trace avec les empreintes de référence',
    type: [MatchingScoreDto],
  })
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => MatchingScoreDto)
  matchings!: MatchingScoreDto[];
}
