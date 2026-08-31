import { ServiceActivityReadModel } from './service-activity-read-model';

export interface ServiceActivityReader {
  operatorExists(operatorUserId: string): Promise<boolean>;
  read(operatorUserId: string | null): Promise<ServiceActivityReadModel>;
}

export const SERVICE_ACTIVITY_READER = 'ServiceActivityReader';
