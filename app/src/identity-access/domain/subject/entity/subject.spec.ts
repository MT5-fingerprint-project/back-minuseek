import { Sex, SexEnum } from '../value-objects/sex.vo';
import { SubjectType, SubjectTypeEnum } from '../value-objects/subject-type.vo';
import { Subject } from './subject';

const aSubject = (overrides: Record<string, unknown> = {}) =>
  Subject.register({
    id: 'subject-1',
    firstName: 'Hélène',
    lastName: 'BERGER',
    birthDate: new Date('1958-09-04'),
    birthPlace: 'Lyon',
    sex: Sex.from(SexEnum.FEMALE),
    type: SubjectType.victim(),
    caseId: 'case-1',
    ...overrides,
  });

describe('Subject', () => {
  it('enregistre une personne du dossier avec ses champs', () => {
    const subject = aSubject();

    expect(subject.firstName).toBe('Hélène');
    expect(subject.lastName).toBe('BERGER');
    expect(subject.birthPlace).toBe('Lyon');
    expect(subject.type.getValue()).toBe(SubjectTypeEnum.VICTIM);
  });

  it.each(Object.values(SubjectTypeEnum))(
    'enregistre un %s sans date ni lieu de naissance',
    (type) => {
      const subject = aSubject({
        type: SubjectType.from(type),
        birthDate: null,
        birthPlace: null,
      });

      expect(subject.birthDate).toBeNull();
      expect(subject.birthPlace).toBeNull();
    },
  );

  it('accepte une date et un lieu de naissance simplement absents', () => {
    const subject = aSubject({ birthDate: undefined, birthPlace: undefined });

    expect(subject.birthDate).toBeNull();
    expect(subject.birthPlace).toBeNull();
  });

  it('normalise un lieu de naissance fait d’espaces en null', () => {
    expect(aSubject({ birthPlace: '   ' }).birthPlace).toBeNull();
  });

  it.each([
    ['un prénom vide', { firstName: '  ' }, /firstName/],
    ['un nom vide', { lastName: '' }, /lastName/],
    ['une affaire absente', { caseId: '' }, /caseId/],
    ['un identifiant absent', { id: '' }, /id/],
    [
      'une date de naissance invalide',
      { birthDate: new Date('pas une date') },
      /birthDate/,
    ],
  ])('refuse %s', (_refus, overrides, message) => {
    expect(() => aSubject(overrides)).toThrow(message);
  });

  it('se relit à l’identique depuis ses primitives', () => {
    const subject = aSubject({ birthDate: null, birthPlace: null });

    expect(
      Subject.reconstitute(subject.toPrimitives()).toPrimitives(),
    ).toStrictEqual(subject.toPrimitives());
  });
});
