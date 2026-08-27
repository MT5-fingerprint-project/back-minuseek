import { ServiceSettings } from './service-settings';

const SRPTS = {
  administration:
    "MINISTÈRE DE L'INTÉRIEUR — DIRECTION GÉNÉRALE DE LA POLICE NATIONALE",
  serviceName: 'SERVICE RÉGIONAL DE POLICE TECHNIQUE ET SCIENTIFIQUE',
  postalAddress: '36 rue du Bastion — 75017 PARIS',
  phoneNumber: '01 40 79 60 00',
  email: 'srpts.paris@interieur.gouv.fr',
  signatureCity: 'Paris',
};

const VIDE = {
  administration: '',
  serviceName: '',
  postalAddress: '',
  phoneNumber: '',
  email: '',
  signatureCity: '',
};

describe('ServiceSettings', () => {
  it("rend six champs vides tant que rien n'a été saisi", () => {
    expect(ServiceSettings.blank().toPrimitives()).toEqual(VIDE);
  });

  it("relit à l'identique l'en-tête enregistré", () => {
    expect(ServiceSettings.reconstitute(SRPTS).toPrimitives()).toEqual(SRPTS);
  });

  it('remplace tous les champs par ceux du nouvel en-tête', () => {
    const settings = ServiceSettings.reconstitute(SRPTS);

    settings.replaceWith({ ...SRPTS, signatureCity: 'Lyon' });

    expect(settings.toPrimitives()).toEqual({
      ...SRPTS,
      signatureCity: 'Lyon',
    });
  });

  it('vide un champ que le nouvel en-tête laisse en blanc', () => {
    const settings = ServiceSettings.reconstitute(SRPTS);

    settings.replaceWith({ ...SRPTS, phoneNumber: '' });

    expect(settings.toPrimitives().phoneNumber).toBe('');
  });

  it('retire les espaces de bord avant de retenir une valeur', () => {
    const settings = ServiceSettings.blank();

    settings.replaceWith({ ...VIDE, signatureCity: '  Paris  ' });

    expect(settings.toPrimitives().signatureCity).toBe('Paris');
  });

  it('réduit à rien un champ qui ne contient que des espaces', () => {
    const settings = ServiceSettings.reconstitute(SRPTS);

    settings.replaceWith({ ...SRPTS, phoneNumber: '   ' });

    expect(settings.toPrimitives().phoneNumber).toBe('');
  });

  it('retient tels quels les accents et la ponctuation du nom du service', () => {
    const settings = ServiceSettings.blank();

    settings.replaceWith({ ...VIDE, serviceName: 'SERVICE — PRÉFECTURE' });

    expect(settings.toPrimitives().serviceName).toBe('SERVICE — PRÉFECTURE');
  });

  it('ne rend que le champ qui change, avec sa nouvelle valeur', () => {
    const settings = ServiceSettings.reconstitute(SRPTS);

    expect(settings.changesTo({ ...SRPTS, signatureCity: 'Lyon' })).toEqual({
      signatureCity: 'Lyon',
    });
  });

  it("rend les six champs au premier enregistrement d'un service", () => {
    expect(ServiceSettings.blank().changesTo(SRPTS)).toEqual(SRPTS);
  });

  it('ne rend aucun changement quand le même en-tête est réenregistré', () => {
    expect(ServiceSettings.reconstitute(SRPTS).changesTo(SRPTS)).toEqual({});
  });

  it('ne voit pas de changement quand seuls les espaces de bord diffèrent', () => {
    const settings = ServiceSettings.reconstitute(SRPTS);

    expect(
      settings.changesTo({ ...SRPTS, email: '  ' + SRPTS.email + ' ' }),
    ).toEqual({});
  });

  it("voit un effacement dans un champ rempli d'espaces", () => {
    const settings = ServiceSettings.reconstitute(SRPTS);

    expect(settings.changesTo({ ...SRPTS, email: '  ' })).toEqual({
      email: '',
    });
  });

  it('rend la chaîne vide du champ que le nouvel en-tête efface', () => {
    const settings = ServiceSettings.reconstitute(SRPTS);

    expect(settings.changesTo({ ...SRPTS, phoneNumber: '' })).toEqual({
      phoneNumber: '',
    });
  });

  it("laisse l'en-tête en place : demander les changements n'en applique aucun", () => {
    const settings = ServiceSettings.reconstitute(SRPTS);

    settings.changesTo(VIDE);

    expect(settings.toPrimitives()).toEqual(SRPTS);
  });

  it('rend une copie que le lecteur ne peut pas altérer', () => {
    const settings = ServiceSettings.reconstitute(SRPTS);

    settings.toPrimitives().serviceName = 'AUTRE SERVICE';

    expect(settings.toPrimitives().serviceName).toBe(SRPTS.serviceName);
  });

  it('reconstitue à partir de ses propres primitives sans rien perdre', () => {
    const settings = ServiceSettings.reconstitute(SRPTS);

    const relu = ServiceSettings.reconstitute(settings.toPrimitives());

    expect(relu.toPrimitives()).toEqual(settings.toPrimitives());
  });

  it('ne partage pas son en-tête vide entre deux services', () => {
    const premier = ServiceSettings.blank();

    premier.replaceWith({ ...VIDE, serviceName: 'SRPTS' });

    expect(ServiceSettings.blank().toPrimitives()).toEqual(VIDE);
  });
});
