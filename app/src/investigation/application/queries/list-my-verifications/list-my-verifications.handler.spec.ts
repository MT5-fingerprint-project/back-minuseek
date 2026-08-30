import { CaseVerificationReadModel } from '../list-case-verifications/case-verification-read-model';
import { VerificationStatusEnum } from '../../../domain/case-verification/value-objects/verification-status.vo';
import { InMemoryCaseVerificationReader } from '../../../infrastructure/persistence/in-memory-case-verification.reader';
import { ListMyVerificationsQuery } from './list-my-verifications.query';
import { ListMyVerificationsHandler } from './list-my-verifications.handler';

const LUCIE = 'user-lucie';

const verification = (
  overrides: Partial<CaseVerificationReadModel>,
): CaseVerificationReadModel => ({
  id: 'verification-1',
  caseId: 'case-1',
  caseNumber: 'AFF-001',
  verifierUserId: LUCIE,
  verifier: { firstName: 'Lucie', lastName: 'Bernard' },
  status: VerificationStatusEnum.PENDING,
  requestedAt: new Date('2026-08-20T10:00:00.000Z'),
  completedAt: null,
  ...overrides,
});

describe('ListMyVerificationsHandler', () => {
  it("rend les missions en cours de l'appelant, de la plus récente à la plus ancienne", async () => {
    const handler = new ListMyVerificationsHandler(
      new InMemoryCaseVerificationReader([
        verification({ id: 'ancienne' }),
        verification({
          id: 'recente',
          caseId: 'case-2',
          caseNumber: 'AFF-002',
          requestedAt: new Date('2026-08-25T10:00:00.000Z'),
        }),
      ]),
    );

    const missions = await handler.execute(new ListMyVerificationsQuery(LUCIE));

    expect(missions.map((mission) => mission.id)).toEqual([
      'recente',
      'ancienne',
    ]);
  });

  it('ne rend rien à un jeton sans compte dans le service', async () => {
    const handler = new ListMyVerificationsHandler(
      new InMemoryCaseVerificationReader([verification({})]),
    );

    expect(await handler.execute(new ListMyVerificationsQuery(null))).toEqual(
      [],
    );
  });

  it('rend aussi les missions closes, que le vérificateur peut relire', async () => {
    const handler = new ListMyVerificationsHandler(
      new InMemoryCaseVerificationReader([
        verification({
          id: 'close',
          status: VerificationStatusEnum.CONCORDANT,
          completedAt: new Date('2026-08-21T10:00:00.000Z'),
        }),
      ]),
    );

    const missions = await handler.execute(new ListMyVerificationsQuery(LUCIE));

    expect(missions.map((mission) => mission.id)).toEqual(['close']);
  });

  it("ne rend pas les missions confiées à quelqu'un d'autre", async () => {
    const handler = new ListMyVerificationsHandler(
      new InMemoryCaseVerificationReader([
        verification({ verifierUserId: 'user-autre' }),
      ]),
    );

    expect(await handler.execute(new ListMyVerificationsQuery(LUCIE))).toEqual(
      [],
    );
  });
});
