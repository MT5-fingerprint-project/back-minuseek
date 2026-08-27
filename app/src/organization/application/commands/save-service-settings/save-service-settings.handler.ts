import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { UserRoleEnum } from '../../../../identity-access/domain/user/value-objects/user-role.vo';
import { ServiceSettings } from '../../../domain/service-settings/entity/service-settings';
import { ServiceSettingsAdministrationNotAllowedError } from '../../../domain/service-settings/errors/service-settings-administration-not-allowed.error';
import {
  SERVICE_SETTINGS_REPOSITORY,
  ServiceSettingsRepository,
} from '../../../domain/service-settings/repository/service-settings.repository';
import { SaveServiceSettingsCommand } from './save-service-settings.command';

@CommandHandler(SaveServiceSettingsCommand)
export class SaveServiceSettingsHandler implements ICommandHandler<
  SaveServiceSettingsCommand,
  void
> {
  constructor(
    @Inject(SERVICE_SETTINGS_REPOSITORY)
    private readonly repo: ServiceSettingsRepository,
  ) {}

  async execute(command: SaveServiceSettingsCommand): Promise<void> {
    if (command.requester.role !== UserRoleEnum.ADMIN) {
      throw new ServiceSettingsAdministrationNotAllowedError();
    }

    const settings = (await this.repo.find()) ?? ServiceSettings.blank();
    const changes = settings.changesTo(command.letterhead);
    // Un enregistrement qui ne change rien n'est pas un acte : il n'aurait
    // aucune valeur à porter au journal.
    if (Object.keys(changes).length === 0) return;

    settings.replaceWith(command.letterhead);
    await this.repo.save(settings, {
      eventType: AuditEventTypeEnum.SERVICE_HEADER_SAVED,
      evidenceClass: EvidenceClassEnum.OBSERVED,
      actor: command.actor,
      caseId: null,
      payload: { changes },
    });
  }
}
