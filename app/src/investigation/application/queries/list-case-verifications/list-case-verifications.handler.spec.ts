import { VerificationStatusEnum } from '../../../domain/case-verification/value-objects/verification-status.vo';
import { InMemoryCaseVerificationReader } from '../../../infrastructure/persistence/in-memory-case-verification.reader';
import { CaseVerificationReadModel } from './case-verification-read-model';
import { ListCaseVerificationsQuery } from './list-case-verifications.query';
import { ListCaseVerificationsHandler } from './list-case-verifications.handler';

const verification = (
  overrides: Partial<CaseVerificationReadModel>,
): CaseVerificationReadModel => ({
  id: 'verification-1',
  caseId: 'case-1',
  caseNumber: 'AFF-001',
  verifierUserId: 'user-lucie',
  verifier: { firstName: 'Lucie', lastName: 'Bernard' },
  status: VerificationStatusEnum.PENDING,
  requestedAt: new Date('2026-08-20T10:00:00.000Z'),
  completedAt: null,
  ...overrides,
});

describe('ListCaseVerificationsHandler', () => {
  it("rend les missions de l'affaire, closes comprises, de la plus récente à la plus ancienne", async () => {
    const handler = new ListCaseVerificationsHandler(
      new InMemoryCaseVerificationReader([
        verification({
          id: 'ancienne',
          status: VerificationStatusEnum.DISCORDANT,
        }),
        verification({
          id: 'recente',
          requestedAt: new Date('2026-08-25T10:00:00.000Z'),
        }),
      ]),
    );

    const missions = await handler.execute(
      new ListCaseVerificationsQuery('case-1'),
    );

    expect(missions.map((mission) => mission.id)).toEqual([
      'recente',
      'ancienne',
    ]);
  });

  it('départage deux missions confiées à la même seconde par leur identifiant', async () => {
    const handler = new ListCaseVerificationsHandler(
      new InMemoryCaseVerificationReader([
        verification({ id: 'verification-b' }),
        verification({ id: 'verification-a' }),
      ]),
    );

    const missions = await handler.execute(
      new ListCaseVerificationsQuery('case-1'),
    );

    expect(missions.map((mission) => mission.id)).toEqual([
      'verification-a',
      'verification-b',
    ]);
  });

  it("ne rend pas les missions d'une autre affaire", async () => {
    const handler = new ListCaseVerificationsHandler(
      new InMemoryCaseVerificationReader([verification({ caseId: 'case-2' })]),
    );

    expect(
      await handler.execute(new ListCaseVerificationsQuery('case-1')),
    ).toEqual([]);
  });
});
