export interface ServiceUserGradesReader {
  listGrades(): Promise<string[]>;
}

export const SERVICE_USER_GRADES_READER = 'ServiceUserGradesReader';
