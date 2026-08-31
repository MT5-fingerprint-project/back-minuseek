import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AddRecipientBookEntryCommand } from '../../application/commands/add-recipient-book-entry/add-recipient-book-entry.command';
import { RemoveRecipientBookEntryCommand } from '../../application/commands/remove-recipient-book-entry/remove-recipient-book-entry.command';
import { ListRecipientBookEntriesQuery } from '../../application/queries/list-recipient-book-entries/list-recipient-book-entries.query';
import { InvalidRecipientBookEntryError } from '../../domain/recipient-book-entry/errors/invalid-recipient-book-entry.error';
import { RecipientBookEntryNotFoundError } from '../../domain/recipient-book-entry/errors/recipient-book-entry-not-found.error';
import { NoCaseScope } from '../../../access/infrastructure/http/case-scope.decorator';
import { AddRecipientBookEntryDto } from './dto/add-recipient-book-entry.dto';

const CATALOGUE_DE_SERVICE =
  "carnet de service : une fiche n'est rattachée à aucune affaire";

@ApiTags('report-recipients')
@Controller('report-recipients')
export class RecipientBookController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @NoCaseScope(CATALOGUE_DE_SERVICE)
  @ApiOperation({ summary: 'Lister le carnet de destinataires du service' })
  @ApiResponse({ status: 200, description: 'Carnet trié par autorité' })
  list() {
    return this.queryBus.execute(new ListRecipientBookEntriesQuery());
  }

  @Post()
  @NoCaseScope(CATALOGUE_DE_SERVICE)
  @ApiOperation({ summary: 'Enregistrer un destinataire dans le carnet' })
  @ApiResponse({ status: 201, description: 'Fiche enregistrée' })
  @ApiResponse({ status: 400, description: 'Autorité destinataire absente' })
  async add(@Body() dto: AddRecipientBookEntryDto) {
    try {
      const id = await this.commandBus.execute<
        AddRecipientBookEntryCommand,
        string
      >(
        new AddRecipientBookEntryCommand(
          dto.authority,
          dto.attentionQuality,
          dto.attentionName,
        ),
      );
      return { id };
    } catch (e) {
      if (e instanceof InvalidRecipientBookEntryError)
        throw new BadRequestException(e.message);
      throw e;
    }
  }

  @Delete(':id')
  @NoCaseScope(CATALOGUE_DE_SERVICE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Retirer un destinataire du carnet' })
  @ApiResponse({ status: 204, description: 'Fiche retirée' })
  @ApiResponse({ status: 404, description: 'Fiche inconnue' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    try {
      await this.commandBus.execute<RemoveRecipientBookEntryCommand, void>(
        new RemoveRecipientBookEntryCommand(id),
      );
    } catch (e) {
      if (e instanceof RecipientBookEntryNotFoundError)
        throw new NotFoundException(e.message);
      throw e;
    }
  }
}
