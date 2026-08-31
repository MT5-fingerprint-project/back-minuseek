import { ServiceActivityReadModel } from '../../application/queries/get-service-activity/service-activity-read-model';
import { ServiceActivityReader } from '../../application/queries/get-service-activity/service-activity.reader';

export class InMemoryServiceActivityReader implements ServiceActivityReader {
  constructor(
    private readonly serviceWide: ServiceActivityReadModel,
    private readonly perOperator: Map<
      string,
      ServiceActivityReadModel
    > = new Map(),
  ) {}

  operatorExists(operatorUserId: string): Promise<boolean> {
    return Promise.resolve(this.perOperator.has(operatorUserId));
  }

  read(operatorUserId: string | null): Promise<ServiceActivityReadModel> {
    if (operatorUserId === null) return Promise.resolve(this.serviceWide);
    return Promise.resolve(
      this.perOperator.get(operatorUserId) ?? this.serviceWide,
    );
  }
}
