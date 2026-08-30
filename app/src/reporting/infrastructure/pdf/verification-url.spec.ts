import { TenantContextService } from '../../../tenancy/application/tenant-context.service';
import {
  FrontOriginVerificationUrl,
  MissingTenantForVerificationUrlError,
} from './verification-url';

const ORIGIN = process.env.FRONT_ORIGIN;

afterEach(() => {
  if (ORIGIN === undefined) {
    delete process.env.FRONT_ORIGIN;
  } else {
    process.env.FRONT_ORIGIN = ORIGIN;
  }
});

function inTenant(slug: string, origin = 'https://minuseek.fr'): string {
  process.env.FRONT_ORIGIN = origin;
  const context = new TenantContextService();
  return context.run({ slug }, () =>
    new FrontOriginVerificationUrl(context).build(),
  );
}

describe('FrontOriginVerificationUrl', () => {
  it('assemble l’origine du front, le laboratoire courant et la page', () => {
    expect(inTenant('srpts-paris')).toBe(
      'https://minuseek.fr/srpts-paris/verification',
    );
  });

  it('ne double pas la barre oblique quand l’origine en porte une', () => {
    expect(inTenant('demo', 'http://localhost:5173/')).toBe(
      'http://localhost:5173/demo/verification',
    );
  });

  it('échoue hors contexte de laboratoire plutôt que de rendre une adresse fausse', () => {
    process.env.FRONT_ORIGIN = 'https://minuseek.fr';

    expect(() =>
      new FrontOriginVerificationUrl(new TenantContextService()).build(),
    ).toThrow(MissingTenantForVerificationUrlError);
  });

  it('échoue quand l’origine du front n’est pas configurée', () => {
    delete process.env.FRONT_ORIGIN;
    const context = new TenantContextService();

    expect(() =>
      context.run({ slug: 'demo' }, () =>
        new FrontOriginVerificationUrl(context).build(),
      ),
    ).toThrow('FRONT_ORIGIN');
  });
});
