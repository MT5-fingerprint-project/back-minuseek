import { ReferencePrint } from '../../domain/reference-print/entity/reference-print';
import { ReferencePrintRepository } from '../../domain/reference-print/repository/reference-print.repository';

export class InMemoryReferencePrintRepository implements ReferencePrintRepository {
  readonly store = new Map<string, ReferencePrint>();

  save(rp: ReferencePrint): Promise<void> {
    this.store.set(rp.id, rp);
    return Promise.resolve();
  }

  findById(id: string): Promise<ReferencePrint | null> {
    return Promise.resolve(this.store.get(id) ?? null);
  }

  delete(id: string): Promise<void> {
    this.store.delete(id);
    return Promise.resolve();
  }
}
