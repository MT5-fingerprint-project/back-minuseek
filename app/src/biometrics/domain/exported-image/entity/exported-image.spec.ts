import { InvalidExportedImageError } from '../errors/invalid-exported-image.error';
import { ExportedImage } from './exported-image';

const CREATED_AT = new Date('2026-08-30T09:00:00.000Z');
const SHA256 = 'a'.repeat(64);

function sealProps(
  overrides: Partial<Parameters<typeof ExportedImage.seal>[0]> = {},
) {
  return {
    id: 'export-1',
    caseId: 'case-1',
    sourcePieceId: 'trace-1',
    sourceKind: 'TRACE' as const,
    path: 'media/investigation-case/case-1/exports/export-1.png',
    sha256: SHA256,
    createdAt: CREATED_AT,
    ...overrides,
  };
}

describe('ExportedImage', () => {
  it('scelle un export et rend ses primitives', () => {
    const image = ExportedImage.seal(sealProps());

    expect(image.toPrimitives()).toEqual({
      id: 'export-1',
      caseId: 'case-1',
      sourcePieceId: 'trace-1',
      sourceKind: 'TRACE',
      path: 'media/investigation-case/case-1/exports/export-1.png',
      sha256: SHA256,
      createdAt: CREATED_AT,
    });
  });

  it("refuse un sha256 qui n'en est pas un", () => {
    expect(() =>
      ExportedImage.seal(sealProps({ sha256: 'pas-un-hash' })),
    ).toThrow(InvalidExportedImageError);
  });

  it('refuse un sha256 en majuscules', () => {
    expect(() =>
      ExportedImage.seal(sealProps({ sha256: 'A'.repeat(64) })),
    ).toThrow(InvalidExportedImageError);
  });

  it('refuse un chemin de stockage vide', () => {
    expect(() => ExportedImage.seal(sealProps({ path: '  ' }))).toThrow(
      InvalidExportedImageError,
    );
  });

  it("refuse un identifiant de pièce d'origine vide", () => {
    expect(() =>
      ExportedImage.seal(sealProps({ sourcePieceId: '  ' })),
    ).toThrow(InvalidExportedImageError);
  });

  it.each(['TRACE', 'REFERENCE_PRINT'] as const)(
    'accepte le genre de pièce %s',
    (sourceKind) => {
      expect(
        ExportedImage.seal(sealProps({ sourceKind })).toPrimitives().sourceKind,
      ).toBe(sourceKind);
    },
  );

  it('se reconstitue depuis ses primitives', () => {
    const image = ExportedImage.reconstitute(
      sealProps({ id: 'export-2', sourceKind: 'REFERENCE_PRINT' }),
    );

    expect(image.id).toBe('export-2');
    expect(image.sha256).toBe(SHA256);
    expect(image.path).toBe(
      'media/investigation-case/case-1/exports/export-1.png',
    );
  });
});
