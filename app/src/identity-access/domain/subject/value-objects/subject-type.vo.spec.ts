import {
  InvalidSubjectTypeError,
  SubjectType,
  SubjectTypeEnum,
} from './subject-type.vo';

describe('SubjectType', () => {
  it('connaît la victime, troisième type de personne du dossier', () => {
    expect(SubjectType.victim().getValue()).toBe(SubjectTypeEnum.VICTIM);
  });

  it.each(Object.values(SubjectTypeEnum))('relit %s tel quel', (value) => {
    expect(SubjectType.from(value).getValue()).toBe(value);
  });

  it.each(['victim', ' VICTIM ', '', 'TÉMOIN', '__proto__'])(
    'refuse %p',
    (raw) => {
      expect(() => SubjectType.from(raw)).toThrow(InvalidSubjectTypeError);
    },
  );

  it('compare par valeur et non par référence', () => {
    expect(SubjectType.victim().equals(SubjectType.from('VICTIM'))).toBe(true);
    expect(SubjectType.victim().equals(SubjectType.closeAssociate())).toBe(
      false,
    );
  });
});
