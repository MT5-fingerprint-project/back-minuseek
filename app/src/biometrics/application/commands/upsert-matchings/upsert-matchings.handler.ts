import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Matching } from '../../../domain/matching/entity/matching';
import {
  MATCHING_REPOSITORY,
  MatchingRepository,
} from '../../../domain/matching/repository/matching.repository';
import {
  ID_GENERATOR,
  IdGenerator,
} from '../../../../shared/domain/ports/id-generator';
import { UpsertMatchingsCommand } from './upsert-matchings.command';

@CommandHandler(UpsertMatchingsCommand)
export class UpsertMatchingsHandler
  implements ICommandHandler<UpsertMatchingsCommand, void>
{
  constructor(
    @Inject(MATCHING_REPOSITORY)
    private readonly repo: MatchingRepository,
    @Inject(ID_GENERATOR)
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(cmd: UpsertMatchingsCommand): Promise<void> {
    const matchings = cmd.matchings.map((m) =>
      Matching.create({
        id: this.idGenerator.generate(),
        traceId: cmd.traceId,
        referencePrintId: m.referencePrintId,
        score: m.score,
        match: m.match,
      }),
    );
    await this.repo.upsertMany(matchings);
  }
}
