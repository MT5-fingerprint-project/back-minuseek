import {
  InvestigationCase,
  InvestigationCasePrimitives,
  NO_JUDICIAL_HEADER,
} from './investigation-case';
import { InvestigationCaseStatusEnum } from '../value-objects/investigation-case-status.vo';
import { CaseClosedError } from '../errors/case-closed.error';
import { InvalidCaseTransitionError } from '../errors/invalid-case-transition.error';
import { InvalidOffensePeriodError } from '../errors/invalid-offense-period.error';

const OPENED_BY = 'user-marie';
const HANDED_TO = 'user-pierre';

const JUNE_1ST = new Date('2026-06-01');
const JUNE_3RD = new Date('2026-06-03');

const A_FULL_JUDICIAL_HEADER = {
  requestDate: new Date('2026-06-04'),
  requesterQuality: 'Brigadier-Chef de Police',
  requesterName: 'MARCHAND Claire',
  requesterService: '3e District de Police Judiciaire de la D.R.P.J de Paris',
  offenseNature: 'Vol par effraction',
  offenseLocation: '12 rue Léon Frot à Paris 11e',
  offenseDateFrom: JUNE_1ST,
  offenseDateTo: JUNE_3RD,
  interventionDate: new Date('2026-06-05'),
  caseAgainst: 'X',
};

function anOpenCase() {
  return InvestigationCase.open({
    id: 'uuid-test',
    caseNumber: 'AFF-001',
    pvNumber: 'PV-2024-001',
    operatorUserId: OPENED_BY,
  });
}

function aCaseIn(status: InvestigationCaseStatusEnum) {
  return InvestigationCase.reconstitute({
    id: 'uuid-test',
    caseNumber: 'AFF-001',
    pvNumber: 'PV-2024-001',
    description: null,
    ...NO_JUDICIAL_HEADER,
    status,
    operatorUserId: OPENED_BY,
    createdAt: new Date('2026-01-01T10:00:00Z'),
    updatedAt: new Date('2026-01-01T10:00:00Z'),
  });
}

function aClosedCase() {
  return InvestigationCase.reconstitute({
    id: 'uuid-test',
    caseNumber: 'AFF-001',
    pvNumber: 'PV-2024-001',
    description: null,
    ...NO_JUDICIAL_HEADER,
    status: InvestigationCaseStatusEnum.CLOSED,
    operatorUserId: OPENED_BY,
    createdAt: new Date('2026-01-01T10:00:00Z'),
    updatedAt: new Date('2026-01-01T10:00:00Z'),
  });
}

describe('InvestigationCase', () => {
  it('ouvre un case avec status OPEN', () => {
    expect(anOpenCase().status).toBe(InvestigationCaseStatusEnum.OPEN);
  });

  it('initialise createdAt et updatedAt', () => {
    const c = anOpenCase();
    expect(c.createdAt).toBeInstanceOf(Date);
    expect(c.updatedAt).toBeInstanceOf(Date);
  });

  it('expose les propriétés passées en entrée', () => {
    const c = InvestigationCase.open({
      id: 'uuid-test',
      caseNumber: 'AFF-001',
      pvNumber: 'PV-2024-001',
      description: 'Un test',
      operatorUserId: OPENED_BY,
    });
    expect(c.id).toBe('uuid-test');
    expect(c.caseNumber).toBe('AFF-001');
    expect(c.description).toBe('Un test');
  });

  it("fait de celui qui ouvre l'affaire son opérateur", () => {
    expect(anOpenCase().operatorUserId).toBe(OPENED_BY);
  });

  it("rend l'opérateur enregistré quand on relit une affaire", () => {
    expect(aClosedCase().operatorUserId).toBe(OPENED_BY);
  });

  it('relit une affaire sans opérateur sans lui en inventer un', () => {
    const c = InvestigationCase.reconstitute({
      id: 'uuid-test',
      caseNumber: 'AFF-001',
      pvNumber: 'PV-2024-001',
      description: null,
      ...NO_JUDICIAL_HEADER,
      status: InvestigationCaseStatusEnum.OPEN,
      operatorUserId: null,
      createdAt: new Date('2026-01-01T10:00:00Z'),
      updatedAt: new Date('2026-01-01T10:00:00Z'),
    });
    expect(c.operatorUserId).toBeNull();
  });

  it('applique la correction reçue et laisse le reste intact', () => {
    const c = InvestigationCase.open({
      id: 'uuid-test',
      caseNumber: 'AFF-001',
      pvNumber: 'PV-2024-001',
      description: 'Un test',
      operatorUserId: OPENED_BY,
    });

    c.correct({ pvNumber: 'PV-2026-118' });

    expect(c.pvNumber).toBe('PV-2026-118');
    expect(c.description).toBe('Un test');
  });

  it('vide la description reçue à null, et garde celle qui n’est pas envoyée', () => {
    const c = InvestigationCase.open({
      id: 'uuid-test',
      caseNumber: 'AFF-001',
      pvNumber: 'PV-2024-001',
      description: 'Un test',
      operatorUserId: OPENED_BY,
    });

    c.correct({ pvNumber: 'PV-2026-118' });
    expect(c.description).toBe('Un test');

    c.correct({ description: null });
    expect(c.description).toBeUndefined();
  });

  it('date la modification quand une information est corrigée', () => {
    const c = InvestigationCase.reconstitute({
      id: 'uuid-test',
      caseNumber: 'AFF-001',
      pvNumber: 'PV-2024-001',
      description: null,
      ...NO_JUDICIAL_HEADER,
      status: InvestigationCaseStatusEnum.OPEN,
      operatorUserId: OPENED_BY,
      createdAt: new Date('2026-01-01T10:00:00Z'),
      updatedAt: new Date('2026-01-01T10:00:00Z'),
    });

    c.correct({ pvNumber: 'PV-2026-118' });

    expect(c.updatedAt.getTime()).toBeGreaterThan(
      new Date('2026-01-01T10:00:00Z').getTime(),
    );
  });

  it("refuse de corriger une affaire close, et n'en change rien", () => {
    const c = aClosedCase();

    expect(() => c.correct({ pvNumber: 'PV-2026-118' })).toThrow(
      CaseClosedError,
    );
    expect(c.pvNumber).toBe('PV-2024-001');
  });

  it("remplace l'opérateur en place, qui n'est jamais deux", () => {
    const c = anOpenCase();

    c.changeOperator(HANDED_TO);

    expect(c.operatorUserId).toBe(HANDED_TO);
  });

  it("date la modification quand l'opérateur change", () => {
    const c = InvestigationCase.reconstitute({
      id: 'uuid-test',
      caseNumber: 'AFF-001',
      pvNumber: 'PV-2024-001',
      description: null,
      ...NO_JUDICIAL_HEADER,
      status: InvestigationCaseStatusEnum.OPEN,
      operatorUserId: OPENED_BY,
      createdAt: new Date('2026-01-01T10:00:00Z'),
      updatedAt: new Date('2026-01-01T10:00:00Z'),
    });

    c.changeOperator(HANDED_TO);

    expect(c.updatedAt.getTime()).toBeGreaterThan(
      new Date('2026-01-01T10:00:00Z').getTime(),
    );
  });

  it("refuse de changer l'opérateur d'une affaire close", () => {
    expect(() => aClosedCase().changeOperator(HANDED_TO)).toThrow(
      CaseClosedError,
    );
  });

  it("laisse l'opérateur en place quand l'affaire est close", () => {
    const c = aClosedCase();

    expect(() => c.changeOperator(HANDED_TO)).toThrow(CaseClosedError);
    expect(c.operatorUserId).toBe(OPENED_BY);
  });
  describe('clôture et réouverture', () => {
    it.each([
      InvestigationCaseStatusEnum.OPEN,
      InvestigationCaseStatusEnum.IN_PROGRESS,
      InvestigationCaseStatusEnum.UNDER_REVIEW,
    ])('clôt une affaire %s', (status) => {
      const c = aCaseIn(status);

      c.close();

      expect(c.status).toBe(InvestigationCaseStatusEnum.CLOSED);
      expect(c.updatedAt.getTime()).toBeGreaterThan(
        new Date('2026-01-01T10:00:00Z').getTime(),
      );
    });

    it('refuse de clore une affaire déjà close', () => {
      expect(() => aClosedCase().close()).toThrow(InvalidCaseTransitionError);
    });

    it('rouvre une affaire close en travail en cours', () => {
      const c = aClosedCase();

      c.reopen();

      expect(c.status).toBe(InvestigationCaseStatusEnum.IN_PROGRESS);
      expect(c.updatedAt.getTime()).toBeGreaterThan(
        new Date('2026-01-01T10:00:00Z').getTime(),
      );
    });

    it("refuse de rouvrir une affaire qui n'est pas close", () => {
      expect(() => anOpenCase().reopen()).toThrow(InvalidCaseTransitionError);
    });
  });

  describe("l'en-tête judiciaire", () => {
    function aCaseWithHeader(
      header: Partial<InvestigationCasePrimitives> = {},
    ) {
      return InvestigationCase.reconstitute({
        id: 'uuid-test',
        caseNumber: 'AFF-001',
        pvNumber: 'PV-2024-001',
        description: null,
        ...NO_JUDICIAL_HEADER,
        status: InvestigationCaseStatusEnum.OPEN,
        operatorUserId: OPENED_BY,
        createdAt: new Date('2026-01-01T10:00:00Z'),
        updatedAt: new Date('2026-01-01T10:00:00Z'),
        ...header,
      });
    }

    it('relit les dix champs judiciaires enregistrés', () => {
      const c = aCaseWithHeader(A_FULL_JUDICIAL_HEADER);

      expect(c.judicialHeader).toEqual(A_FULL_JUDICIAL_HEADER);
    });

    it('ouvre une affaire dont les dix champs judiciaires sont vides', () => {
      expect(anOpenCase().judicialHeader).toEqual(NO_JUDICIAL_HEADER);
    });

    it('applique le seul champ envoyé et laisse les neuf autres intacts', () => {
      const c = aCaseWithHeader(A_FULL_JUDICIAL_HEADER);

      c.correct({ offenseNature: 'Viol sur personne vulnérable' });

      expect(c.judicialHeader).toEqual({
        ...A_FULL_JUDICIAL_HEADER,
        offenseNature: 'Viol sur personne vulnérable',
      });
    });

    it('vide le champ envoyé à null et garde celui qui n’est pas envoyé', () => {
      const c = aCaseWithHeader(A_FULL_JUDICIAL_HEADER);

      c.correct({ offenseLocation: null });

      expect(c.judicialHeader.offenseLocation).toBeNull();
      expect(c.judicialHeader.offenseNature).toBe('Vol par effraction');
    });

    it('accepte une période des faits sur un seul jour', () => {
      const c = aCaseWithHeader();

      c.correct({ offenseDateFrom: JUNE_1ST, offenseDateTo: JUNE_1ST });

      expect(c.judicialHeader.offenseDateTo).toEqual(JUNE_1ST);
    });

    it('refuse une fin de période antérieure à la date des faits', () => {
      const c = aCaseWithHeader();

      expect(() =>
        c.correct({ offenseDateFrom: JUNE_3RD, offenseDateTo: JUNE_1ST }),
      ).toThrow(InvalidOffensePeriodError);
    });

    it('refuse une fin de période sans début', () => {
      const c = aCaseWithHeader();

      expect(() => c.correct({ offenseDateTo: JUNE_3RD })).toThrow(
        InvalidOffensePeriodError,
      );
    });

    it('juge la période sur le résultat, pas sur le seul champ envoyé', () => {
      const c = aCaseWithHeader({ offenseDateFrom: JUNE_3RD });

      expect(() => c.correct({ offenseDateTo: JUNE_1ST })).toThrow(
        InvalidOffensePeriodError,
      );
    });

    it('laisse lever la fin seule d’une période déjà enregistrée', () => {
      const c = aCaseWithHeader({
        offenseDateFrom: JUNE_1ST,
        offenseDateTo: JUNE_3RD,
      });

      c.correct({ offenseDateTo: null });

      expect(c.judicialHeader.offenseDateTo).toBeNull();
      expect(c.judicialHeader.offenseDateFrom).toEqual(JUNE_1ST);
    });

    it('refuse de vider le début d’une période dont la fin reste', () => {
      const c = aCaseWithHeader({
        offenseDateFrom: JUNE_1ST,
        offenseDateTo: JUNE_3RD,
      });

      expect(() => c.correct({ offenseDateFrom: null })).toThrow(
        InvalidOffensePeriodError,
      );
    });

    it('ne corrige rien du tout quand la période est refusée', () => {
      const c = aCaseWithHeader();

      expect(() =>
        c.correct({
          pvNumber: 'PV-2026-118',
          offenseNature: 'Vol par effraction',
          offenseDateTo: JUNE_3RD,
        }),
      ).toThrow(InvalidOffensePeriodError);
      expect(c.pvNumber).toBe('PV-2024-001');
      expect(c.judicialHeader.offenseNature).toBeNull();
      expect(c.updatedAt).toEqual(new Date('2026-01-01T10:00:00Z'));
    });

    it("refuse de renseigner l'en-tête judiciaire d'une affaire close", () => {
      const c = aCaseWithHeader({ status: InvestigationCaseStatusEnum.CLOSED });

      expect(() => c.correct({ caseAgainst: 'X' })).toThrow(CaseClosedError);
      expect(c.judicialHeader.caseAgainst).toBeNull();
    });
  });
});
