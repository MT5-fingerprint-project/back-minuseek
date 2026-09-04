import { InMemoryAuditTrailAppender } from '../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import {
  AuditEventDraft,
  AuditTrailPort,
} from '../../../shared/domain/ports/audit-trail.port';
import { MinutiaTypeEnum } from '../../../shared/domain/forensics/minutiae';
import { minutiaTypeOf } from '../../domain/layer/minutia';
import { MinutiaPair } from '../../domain/minutia-pair/entity/minutia-pair';
import { MinutiaPairAlreadyExistsError } from '../../domain/minutia-pair/errors/minutia-pair-already-exists.error';
import type { MinutiaPairRepository } from '../../domain/minutia-pair/repository/minutia-pair.repository';
import type {
  MinutiaPairReader,
  MinutiaPairRow,
} from '../../application/queries/list-minutia-pairs/minutia-pair.reader';
import type { InMemoryLayerRepository } from './in-memory-layer.repository';

export class InMemoryMinutiaPairRepository
  implements MinutiaPairRepository, MinutiaPairReader
{
  readonly store = new Map<string, MinutiaPair>();

  constructor(
    private readonly layers: InMemoryLayerRepository,
    readonly auditTrail: AuditTrailPort = new InMemoryAuditTrailAppender(),
  ) {
    layers.onLayerDeleted((layerId) => this.cascadeOnLayerDeletion(layerId));
  }

  seed(pair: MinutiaPair): void {
    this.store.set(pair.id, pair);
  }

  async save(pair: MinutiaPair, act: AuditEventDraft): Promise<void> {
    if (this.violatesUniqueness(pair)) {
      throw new MinutiaPairAlreadyExistsError();
    }
    this.store.set(pair.id, pair);
    await this.auditTrail.append(act);
  }

  findById(id: string): Promise<MinutiaPair | null> {
    return Promise.resolve(this.store.get(id) ?? null);
  }

  async delete(id: string, act: AuditEventDraft): Promise<void> {
    this.store.delete(id);
    await this.auditTrail.append(act);
  }

  findByMinutiaLayerId(layerId: string): Promise<MinutiaPair[]> {
    return Promise.resolve(
      [...this.store.values()].filter(
        (pair) =>
          pair.traceMinutiaLayerId === layerId ||
          pair.referenceMinutiaLayerId === layerId,
      ),
    );
  }

  private cascadeOnLayerDeletion(layerId: string): void {
    for (const pair of [...this.store.values()]) {
      if (
        pair.traceMinutiaLayerId === layerId ||
        pair.referenceMinutiaLayerId === layerId
      ) {
        this.store.delete(pair.id);
      }
    }
  }

  async findByTraceAndReferencePrint(
    traceId: string,
    referencePrintId: string,
    authoredBy?: string | null,
  ): Promise<MinutiaPairRow[]> {
    const rows: MinutiaPairRow[] = [];
    for (const pair of this.store.values()) {
      if (
        pair.traceId !== traceId ||
        pair.referencePrintId !== referencePrintId
      ) {
        continue;
      }
      const traceMinutia = await this.layers.findById(pair.traceMinutiaLayerId);
      const referenceMinutia = await this.layers.findById(
        pair.referenceMinutiaLayerId,
      );
      if (
        authoredBy != null &&
        (traceMinutia?.createdByUserId !== authoredBy ||
          referenceMinutia?.createdByUserId !== authoredBy)
      ) {
        continue;
      }
      rows.push({
        id: pair.id,
        createdAt: pair.createdAt,
        traceMinutiaLayerId: pair.traceMinutiaLayerId,
        referenceMinutiaLayerId: pair.referenceMinutiaLayerId,
        minutiaType:
          traceMinutia === null
            ? MinutiaTypeEnum.UNDETERMINED
            : minutiaTypeOf(traceMinutia.toPrimitives().settings),
      });
    }
    return rows;
  }

  private violatesUniqueness(pair: MinutiaPair): boolean {
    return [...this.store.values()].some(
      (stored) =>
        stored.id !== pair.id &&
        ((stored.traceMinutiaLayerId === pair.traceMinutiaLayerId &&
          stored.referencePrintId === pair.referencePrintId) ||
          (stored.referenceMinutiaLayerId === pair.referenceMinutiaLayerId &&
            stored.traceId === pair.traceId)),
    );
  }
}
