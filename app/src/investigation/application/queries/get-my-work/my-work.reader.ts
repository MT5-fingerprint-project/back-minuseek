import { MyWorkReadModel } from './my-work-read-model';

export interface MyWorkReader {
  read(operatorUserId: string): Promise<MyWorkReadModel>;
}

export const MY_WORK_READER = 'MyWorkReader';
