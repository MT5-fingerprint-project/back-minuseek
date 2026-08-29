export interface ServiceLetterheadData {
  administration: string;
  serviceName: string;
  postalAddress: string;
  phoneNumber: string;
  email: string;
  signatureCity: string;
}

export interface ServiceLetterheadReader {
  read(): Promise<ServiceLetterheadData>;
}

export const SERVICE_LETTERHEAD_READER = 'ServiceLetterheadReader';
