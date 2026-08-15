import type { Prisma } from '../../../../generated/prisma/client';
import { TransactionContextService } from './transaction-context.service';

const fakeTransaction = (label: string): Prisma.TransactionClient =>
  ({ label }) as unknown as Prisma.TransactionClient;

describe('TransactionContextService', () => {
  const service = new TransactionContextService();

  it('expose la transaction à l’intérieur de run(), rien à l’extérieur', () => {
    const transaction = fakeTransaction('tx');
    expect(service.getCurrentTransaction()).toBeUndefined();

    const insideRun = service.run(transaction, () =>
      service.getCurrentTransaction(),
    );

    expect(insideRun).toBe(transaction);
    expect(service.getCurrentTransaction()).toBeUndefined();
  });

  it('propage la transaction à travers la chaîne async', async () => {
    const transaction = fakeTransaction('tx');
    const observed = await service.run(transaction, async () => {
      await Promise.resolve();
      return service.getCurrentTransaction();
    });
    expect(observed).toBe(transaction);
  });

  it('isole deux transactions concurrentes', async () => {
    const transactionA = fakeTransaction('a');
    const transactionB = fakeTransaction('b');
    const [first, second] = await Promise.all([
      service.run(transactionA, async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return service.getCurrentTransaction();
      }),
      service.run(transactionB, async () => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return service.getCurrentTransaction();
      }),
    ]);
    expect(first).toBe(transactionA);
    expect(second).toBe(transactionB);
  });
});
