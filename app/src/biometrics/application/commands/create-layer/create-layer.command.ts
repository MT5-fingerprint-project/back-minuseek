import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';
import type {
  LayerSettings,
  LayerType,
} from '../../../domain/layer/entity/layer';

export class CreateLayerCommand {
  constructor(
    public readonly actor: AuditActor,
    public readonly id: string,
    public readonly fingerprintId: string,
    public readonly name: string,
    public readonly type: LayerType,
    public readonly zIndex: number,
    public readonly settings: LayerSettings,
  ) {}
}
