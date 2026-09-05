import { MyWorkReadModel } from '../../application/queries/get-my-work/my-work-read-model';
import { MyWorkReader } from '../../application/queries/get-my-work/my-work.reader';

export const EMPTY_MY_WORK: MyWorkReadModel = {
  period: {
    from: new Date('2026-01-01T00:00:00.000Z'),
    to: new Date('2026-01-01T00:00:00.000Z'),
  },
  production: { collected: 0, exploitable: 0, compared: 0, identified: 0 },
  cases: {
    open: 0,
    ageBrackets: { overSixMonths: 0, threeToSixMonths: 0, underThreeMonths: 0 },
    oldest: [],
  },
  discordances: [],
  pendingTraces: [],
};

export class InMemoryMyWorkReader implements MyWorkReader {
  readonly readFor: string[] = [];

  constructor(
    private readonly perOperator: Map<string, MyWorkReadModel> = new Map(),
  ) {}

  read(operatorUserId: string): Promise<MyWorkReadModel> {
    this.readFor.push(operatorUserId);
    return Promise.resolve(
      this.perOperator.get(operatorUserId) ?? EMPTY_MY_WORK,
    );
  }
}
