import { InvalidRecipientBookEntryError } from '../errors/invalid-recipient-book-entry.error';
import { RecipientBookEntry } from './recipient-book-entry';

const AUTHORITY =
  'Le Commissaire Général, chef du 3e District de Police Judiciaire';

const anEntry = (overrides: Record<string, unknown> = {}) =>
  RecipientBookEntry.create({
    id: 'entry-1',
    authority: AUTHORITY,
    attentionQuality: 'Brigadier-Chef de Police',
    attentionName: 'MARCHAND Claire',
    ...overrides,
  });

describe('RecipientBookEntry', () => {
  it('enregistre une fiche avec sa mention « à l’attention de »', () => {
    const entry = anEntry();

    expect(entry.id).toBe('entry-1');
    expect(entry.authority).toBe(AUTHORITY);
    expect(entry.attentionQuality).toBe('Brigadier-Chef de Police');
    expect(entry.attentionName).toBe('MARCHAND Claire');
  });

  it('enregistre une fiche sans mention « à l’attention de »', () => {
    const entry = anEntry({
      attentionQuality: undefined,
      attentionName: undefined,
    });

    expect(entry.attentionQuality).toBeNull();
    expect(entry.attentionName).toBeNull();
  });

  it('normalise les champs faits d’espaces en null', () => {
    const entry = anEntry({ attentionQuality: '  ', attentionName: '   ' });

    expect(entry.attentionQuality).toBeNull();
    expect(entry.attentionName).toBeNull();
  });

  it('ôte les espaces autour de l’autorité', () => {
    expect(anEntry({ authority: `  ${AUTHORITY}  ` }).authority).toBe(
      AUTHORITY,
    );
  });

  it.each([[''], ['   '], ['\n\t']])(
    'refuse une autorité vide (%p)',
    (authority) => {
      expect(() => anEntry({ authority })).toThrow(
        InvalidRecipientBookEntryError,
      );
    },
  );

  it('se relit à l’identique depuis ses primitives', () => {
    const entry = anEntry();

    expect(
      RecipientBookEntry.reconstitute(entry.toPrimitives()).toPrimitives(),
    ).toStrictEqual(entry.toPrimitives());
  });

  it('relit une fiche archivée dont l’autorité serait vide, sans la refuser', () => {
    const primitives = {
      id: 'entry-1',
      authority: '',
      attentionQuality: null,
      attentionName: null,
      createdAt: new Date('2026-01-01T10:00:00Z'),
      updatedAt: new Date('2026-01-01T10:00:00Z'),
    };

    expect(RecipientBookEntry.reconstitute(primitives).authority).toBe('');
  });
});
