import { VerificationNotFoundError } from '../../../domain/case-verification/errors/verification-not-found.error';
import { VerificationExploitabilityEnum } from '../../../domain/case-verification/value-objects/verification-exploitability.vo';
import { VerificationStatusEnum } from '../../../domain/case-verification/value-objects/verification-status.vo';
import { InMemoryCaseVerificationReader } from '../../../infrastructure/persistence/in-memory-case-verification.reader';
import { GetVerificationQuery } from './get-verification.query';
import { GetVerificationHandler } from './get-verification.handler';

const LUCIE = 'user-lucie';

const MISSION = {
  id: 'verification-1',
  caseId: 'case-1',
  caseNumber: 'AFF-001',
  verifierUserId: LUCIE,
  verifier: { firstName: 'Lucie', lastName: 'Bernard' },
  status: VerificationStatusEnum.PENDING,
  requestedAt: new Date('2026-08-20T10:00:00.000Z'),
  completedAt: null,
};

const CONCLUSION = {
  traceId: 'trace-1',
  exploitability: VerificationExploitabilityEnum.EXPLOITABLE,
  identifiedReferencePrintId: 'ref-1',
  outcome: null,
  statedAt: new Date('2026-08-21T10:00:00.000Z'),
};

const readerWith = () =>
  new InMemoryCaseVerificationReader([MISSION], {
    'verification-1': [CONCLUSION],
  });

describe('GetVerificationHandler', () => {
  it('rend au vérificateur sa mission et ses conclusions', async () => {
    const handler = new GetVerificationHandler(readerWith());

    const detail = await handler.execute(
      new GetVerificationQuery('verification-1', LUCIE),
    );

    expect(detail.caseNumber).toBe('AFF-001');
    expect(detail.conclusions).toEqual([CONCLUSION]);
  });

  it("ne montre pas la mission d'un autre, et ne dit pas qu'elle existe", async () => {
    const handler = new GetVerificationHandler(readerWith());

    await expect(
      handler.execute(new GetVerificationQuery('verification-1', 'user-marie')),
    ).rejects.toBeInstanceOf(VerificationNotFoundError);
  });

  it('refuse un jeton sans compte dans le service', async () => {
    const handler = new GetVerificationHandler(readerWith());

    await expect(
      handler.execute(new GetVerificationQuery('verification-1', null)),
    ).rejects.toBeInstanceOf(VerificationNotFoundError);
  });

  it('refuse une mission inconnue', async () => {
    const handler = new GetVerificationHandler(readerWith());

    await expect(
      handler.execute(new GetVerificationQuery('introuvable', LUCIE)),
    ).rejects.toBeInstanceOf(VerificationNotFoundError);
  });
});
