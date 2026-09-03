import { Inject, Injectable } from '@nestjs/common';
import { AuditActor } from '../../../shared/domain/audit/audit-actor.vo';
import { AuditEventTypeEnum } from '../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../shared/domain/audit/evidence-class.vo';
import type { FamiliarPrintDestructionPort } from '../../../investigation/application/ports/familiar-print-destruction.port';
import { ReferencePrint } from '../../domain/reference-print/entity/reference-print';
import {
  REFERENCE_PRINT_REPOSITORY,
  ReferencePrintRepository,
} from '../../domain/reference-print/repository/reference-print.repository';
import {
  FAMILIAR_REFERENCE_PRINT_READER,
  FamiliarReferencePrintReader,
} from '../ports/familiar-reference-print.reader';
import { IMAGE_STORAGE, ImageStoragePort } from '../ports/image-storage.port';
import { archivedOriginalPath, thumbnailPath } from './displayable-image';

@Injectable()
export class FamiliarPrintDestructionService implements FamiliarPrintDestructionPort {
  constructor(
    @Inject(FAMILIAR_REFERENCE_PRINT_READER)
    private readonly reader: FamiliarReferencePrintReader,
    @Inject(REFERENCE_PRINT_REPOSITORY)
    private readonly repository: ReferencePrintRepository,
    @Inject(IMAGE_STORAGE)
    private readonly storage: ImageStoragePort,
  ) {}

  async destroyForCase(
    caseId: string,
    actor: AuditActor,
  ): Promise<{ destroyedCount: number }> {
    const prints = await this.reader.findDestroyableByCaseId(caseId);
    let destroyedCount = 0;
    for (const print of prints) {
      await this.destroy(print, actor);
      destroyedCount += 1;
    }
    return { destroyedCount };
  }

  /**
   * L'objet d'abord, la ligne ensuite. Marquer avant de supprimer ferait dire au
   * journal une destruction qui n'a pas eu lieu si le stockage échoue ; dans cet
   * ordre, un échec entre les deux laisse une ligne qui pointe vers un objet
   * absent, que la tentative suivante corrige — supprimer deux fois ne lève rien.
   * Une empreinte à la fois : chaque acte porte l'heure réelle de sa destruction.
   */
  private async destroy(
    print: ReferencePrint,
    actor: AuditActor,
  ): Promise<void> {
    await this.storage.delete(print.path);
    const archived = archivedOriginalPath(print.path);
    if (archived) {
      await this.storage.delete(archived);
    }
    // La vignette se supprime par convention et non par la colonne : un acte
    // qui affirme la destruction ne doit pas laisser d'image, même si la
    // colonne a été perdue entre le stockage de la vignette et son écriture.
    await this.storage.delete(thumbnailPath(print.path));

    print.markImageDestroyed(new Date());
    await this.repository.save(print, {
      eventType: AuditEventTypeEnum.REFERENCE_PRINT_IMAGE_DESTROYED,
      evidenceClass: EvidenceClassEnum.OBSERVED,
      actor,
      caseId: print.caseId,
      payload: {
        referencePrintId: print.id,
        subjectId: print.subjectId,
        position: print.position?.getValue() ?? null,
        storagePath: print.path,
        fileSha256: print.sha256,
      },
    });
  }
}
