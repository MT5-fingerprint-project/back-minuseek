import { UserRoleEnum } from '../../../../identity-access/domain/user/value-objects/user-role.vo';
import { UnknownOperatorError } from '../../../domain/investigation-case/errors/unknown-operator.error';
import { InMemoryServiceActivityReader } from '../../../infrastructure/persistence/in-memory-service-activity.reader';
import { ServiceActivityNotAllowedError } from '../../../domain/investigation-case/errors/service-activity-not-allowed.error';
import { GetServiceActivityHandler } from './get-service-activity.handler';
import { GetServiceActivityQuery } from './get-service-activity.query';
import {
  OperatorCaseloadReadModel,
  ServiceActivityReadModel,
} from './service-activity-read-model';

const NADIA = { id: 'nadia', firstName: 'Nadia', lastName: 'Berthier' };
const MARC = { id: 'marc', firstName: 'Marc', lastName: 'Olivier' };

const RESPONSABLE = { id: 'claire', role: UserRoleEnum.ADMIN };
const OPERATEUR = { id: NADIA.id, role: UserRoleEnum.OPERATOR };

const REPARTITION: OperatorCaseloadReadModel[] = [
  {
    operator: NADIA,
    openCases: 4,
    closedInPeriod: 12,
    medianClosureDays: 31,
  },
  { operator: MARC, openCases: 2, closedInPeriod: 3, medianClosureDays: null },
  { operator: null, openCases: 1, closedInPeriod: 0, medianClosureDays: null },
];

function statistics(
  overrides: Partial<ServiceActivityReadModel> = {},
): ServiceActivityReadModel {
  return {
    period: {
      from: new Date('2025-12-31T23:00:00Z'),
      to: new Date('2026-08-30T12:00:00Z'),
    },
    cases: {
      open: 7,
      openOver90Days: 2,
      openedInPeriod: 22,
      closedInPeriod: 15,
      medianClosureDays: 28,
      ninthDecileClosureDays: 96,
      monthlyFlow: [{ month: '2026-01', opened: 3, closed: 1 }],
      openCases: [],
      ...overrides.cases,
    },
    traces: {
      collected: 40,
      exploitable: 0,
      compared: 18,
      identified: 6,
      ...overrides.traces,
    },
    signals: {
      dormantOver30Days: 3,
      expertiseDeadlinesUnder15Days: 1,
      exploitableNeverCompared: 0,
      openWithoutOperator: 1,
      ...overrides.signals,
    },
    byOperator: REPARTITION,
    ...overrides,
  };
}

const SERVICE = statistics();

const AFFAIRES_DE_NADIA = statistics({
  cases: { ...SERVICE.cases, open: 4, openedInPeriod: 9, closedInPeriod: 12 },
  traces: { ...SERVICE.traces, collected: 11, compared: 5, identified: 2 },
  signals: { ...SERVICE.signals, dormantOver30Days: 1, openWithoutOperator: 0 },
});

function build(): GetServiceActivityHandler {
  return new GetServiceActivityHandler(
    new InMemoryServiceActivityReader(
      SERVICE,
      new Map([[NADIA.id, AFFAIRES_DE_NADIA]]),
    ),
  );
}

describe('GetServiceActivityHandler', () => {
  it("rend les chiffres du service entier quand aucun opérateur n'est passé", async () => {
    const lecture = await build().execute(
      new GetServiceActivityQuery(RESPONSABLE),
    );

    expect(lecture.cases.open).toBe(7);
    expect(lecture.traces.collected).toBe(40);
  });

  it('refuse un opérateur qui appelle la lecture', async () => {
    await expect(
      build().execute(new GetServiceActivityQuery(OPERATEUR)),
    ).rejects.toBeInstanceOf(ServiceActivityNotAllowedError);
  });

  it('refuse aussi un compte expert', async () => {
    await expect(
      build().execute(
        new GetServiceActivityQuery({
          id: 'paul',
          role: UserRoleEnum.EXPERT,
        }),
      ),
    ).rejects.toBeInstanceOf(ServiceActivityNotAllowedError);
  });

  it("refuse le rôle avant de toucher au filtre, même si l'opérateur est inconnu", async () => {
    await expect(
      build().execute(new GetServiceActivityQuery(OPERATEUR, 'fantome')),
    ).rejects.toBeInstanceOf(ServiceActivityNotAllowedError);
  });

  it("signale un identifiant d'opérateur qui n'existe pas", async () => {
    await expect(
      build().execute(new GetServiceActivityQuery(RESPONSABLE, 'fantome')),
    ).rejects.toBeInstanceOf(UnknownOperatorError);
  });

  it("restreint les dossiers et les traces aux affaires de l'opérateur passé", async () => {
    const lecture = await build().execute(
      new GetServiceActivityQuery(RESPONSABLE, NADIA.id),
    );

    expect(lecture.cases.open).toBe(4);
    expect(lecture.cases.closedInPeriod).toBe(12);
    expect(lecture.traces.collected).toBe(11);
    expect(lecture.traces.identified).toBe(2);
  });

  it("ne laisse aucun dossier sans opérateur quand on filtre sur quelqu'un", async () => {
    const lecture = await build().execute(
      new GetServiceActivityQuery(RESPONSABLE, NADIA.id),
    );

    expect(lecture.signals.openWithoutOperator).toBe(0);
  });

  it('garde la répartition du service entier malgré le filtre', async () => {
    const lecture = await build().execute(
      new GetServiceActivityQuery(RESPONSABLE, NADIA.id),
    );

    expect(lecture.byOperator).toEqual(REPARTITION);
  });
});
