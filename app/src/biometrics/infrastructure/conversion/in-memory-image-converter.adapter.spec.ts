import { InvalidImageError } from '../../application/ports/image-converter.port';
import { InMemoryImageConverter } from './in-memory-image-converter.adapter';

const converter = new InMemoryImageConverter();

describe('InMemoryImageConverter — vignette d’affichage', () => {
  it('marque la vignette qu’il rend', async () => {
    const thumbnail = await converter.toDisplayThumbnail(
      Buffer.from('une trace'),
    );

    expect(thumbnail.toString()).toBe('thumb:une trace');
  });

  it('rend une vignette distincte du PNG affichable de la même source', async () => {
    const source = Buffer.from('une trace');

    const [thumbnail, png] = await Promise.all([
      converter.toDisplayThumbnail(source),
      converter.tiffToPng(source),
    ]);

    expect(thumbnail.equals(png)).toBe(false);
  });

  it('refuse un contenu marqué invalide, comme l’adapter sharp', async () => {
    await expect(
      converter.toDisplayThumbnail(Buffer.from('contenu invalid')),
    ).rejects.toBeInstanceOf(InvalidImageError);
  });

  it('laisse la source intacte', async () => {
    const source = Buffer.from('une trace');
    const untouched = Buffer.from(source);

    await converter.toDisplayThumbnail(source);

    expect(source.equals(untouched)).toBe(true);
  });
});
