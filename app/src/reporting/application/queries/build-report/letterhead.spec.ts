import { ServiceLetterheadData } from '../../ports/service-letterhead.reader';
import { buildLetterhead, signatureCityOf } from './letterhead';

function settings(
  overrides: Partial<ServiceLetterheadData> = {},
): ServiceLetterheadData {
  return {
    administration: 'Direction Régionale de la Police Judiciaire de Paris',
    serviceName: 'Service Régional de Police Technique et Scientifique',
    postalAddress: '36 rue du Bastion, 75017 Paris',
    phoneNumber: '01 40 79 00 00',
    email: 'srpts-paris@interieur.gouv.fr',
    signatureCity: 'Paris',
    ...overrides,
  };
}

const NOTHING_FILLED: ServiceLetterheadData = {
  administration: '',
  serviceName: '',
  postalAddress: '',
  phoneNumber: '',
  email: '',
  signatureCity: '',
};

describe('buildLetterhead', () => {
  it('reprend les cinq lignes de l’en-tête telles qu’elles ont été saisies', () => {
    expect(buildLetterhead(settings())).toEqual({
      administration: 'Direction Régionale de la Police Judiciaire de Paris',
      serviceName: 'Service Régional de Police Technique et Scientifique',
      postalAddress: '36 rue du Bastion, 75017 Paris',
      phoneNumber: '01 40 79 00 00',
      email: 'srpts-paris@interieur.gouv.fr',
    });
  });

  it('ne rend aucun en-tête quand le service n’a rien rempli', () => {
    expect(buildLetterhead(NOTHING_FILLED)).toBeNull();
  });

  it('ne rend aucun en-tête quand les champs ne portent que des espaces', () => {
    expect(
      buildLetterhead({ ...NOTHING_FILLED, serviceName: '   ' }),
    ).toBeNull();
  });

  it('imprime un en-tête partiel plutôt que rien, et laisse les lignes vides à null', () => {
    expect(
      buildLetterhead({
        ...NOTHING_FILLED,
        serviceName: 'S.R.P.T.S. de Paris',
      }),
    ).toEqual({
      administration: null,
      serviceName: 'S.R.P.T.S. de Paris',
      postalAddress: null,
      phoneNumber: null,
      email: null,
    });
  });

  it('ne compte pas la ville de signature comme une ligne d’en-tête', () => {
    expect(
      buildLetterhead({ ...NOTHING_FILLED, signatureCity: 'Paris' }),
    ).toBeNull();
  });
});

describe('signatureCityOf', () => {
  it('rend la ville des paramètres du service', () => {
    expect(signatureCityOf(settings())).toBe('Paris');
  });

  it('rend null quand aucune ville n’est saisie', () => {
    expect(signatureCityOf(NOTHING_FILLED)).toBeNull();
  });

  it('rend null sur une ville qui ne porte que des espaces', () => {
    expect(signatureCityOf(settings({ signatureCity: '  ' }))).toBeNull();
  });
});
