export interface ServiceSettingsReadModel {
  administration: string;
  serviceName: string;
  postalAddress: string;
  phoneNumber: string;
  email: string;
  signatureCity: string;
}

export function blankServiceSettings(): ServiceSettingsReadModel {
  return {
    administration: '',
    serviceName: '',
    postalAddress: '',
    phoneNumber: '',
    email: '',
    signatureCity: '',
  };
}
