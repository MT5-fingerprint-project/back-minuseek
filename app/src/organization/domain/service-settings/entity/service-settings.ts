export interface ServiceLetterhead {
  administration: string;
  serviceName: string;
  postalAddress: string;
  phoneNumber: string;
  email: string;
  signatureCity: string;
}

export type ServiceLetterheadChanges = Partial<ServiceLetterhead>;

const LETTERHEAD_FIELDS: (keyof ServiceLetterhead)[] = [
  'administration',
  'serviceName',
  'postalAddress',
  'phoneNumber',
  'email',
  'signatureCity',
];

function trimmed(letterhead: ServiceLetterhead): ServiceLetterhead {
  return {
    administration: letterhead.administration.trim(),
    serviceName: letterhead.serviceName.trim(),
    postalAddress: letterhead.postalAddress.trim(),
    phoneNumber: letterhead.phoneNumber.trim(),
    email: letterhead.email.trim(),
    signatureCity: letterhead.signatureCity.trim(),
  };
}

/**
 * Réglage à jeu unique par service : l'identité du service émetteur telle
 * qu'elle s'imprime en tête de rapport. Un service qui n'a rien saisi a un
 * en-tête vide, jamais absent.
 */
export class ServiceSettings {
  private constructor(private letterhead: ServiceLetterhead) {}

  static blank(): ServiceSettings {
    return new ServiceSettings({
      administration: '',
      serviceName: '',
      postalAddress: '',
      phoneNumber: '',
      email: '',
      signatureCity: '',
    });
  }

  static reconstitute(letterhead: ServiceLetterhead): ServiceSettings {
    return new ServiceSettings(trimmed(letterhead));
  }

  changesTo(letterhead: ServiceLetterhead): ServiceLetterheadChanges {
    const wanted = trimmed(letterhead);
    const changes: ServiceLetterheadChanges = {};
    for (const field of LETTERHEAD_FIELDS) {
      if (wanted[field] !== this.letterhead[field]) {
        changes[field] = wanted[field];
      }
    }
    return changes;
  }

  replaceWith(letterhead: ServiceLetterhead): void {
    this.letterhead = trimmed(letterhead);
  }

  toPrimitives(): ServiceLetterhead {
    return { ...this.letterhead };
  }
}
