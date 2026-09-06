import type {
  ReportDemonstrationMarkViewModel,
  ReportImageViewModel,
} from '../../../application/report-view-model';
import { renderPlate } from './plate-block';

const IMAGE: ReportImageViewModel = {
  dataUrl: 'data:image/png;base64,planche',
  width: 6768,
  height: 7887,
  observedSha256: null,
  lifeSizeMm: null,
};

function mark(
  overrides: Partial<ReportDemonstrationMarkViewModel> = {},
): ReportDemonstrationMarkViewModel {
  return {
    number: 1,
    x: 100,
    y: 200,
    radius: 36,
    label: 'bifurcation',
    ...overrides,
  };
}

function render(marks: ReportDemonstrationMarkViewModel[]): string {
  return renderPlate({
    title: 'Planche de démonstration',
    subtitle: null,
    image: IMAGE,
    marks,
    cote: 'A',
    caption: 'Trace et empreinte de référence',
  });
}

describe('renderPlate — les repères de la planche', () => {
  it('cercle chaque repère au rayon qu’il porte', () => {
    expect(render([mark({ radius: 36 })])).toContain(
      '<circle cx="100" cy="200" r="36"',
    );
  });

  it('donne au trait le quart du rayon, pour que l’anneau reste un anneau', () => {
    expect(render([mark({ radius: 36 })])).toContain('stroke-width="9"');
  });

  it('épaissit le trait d’un grand repère du même quart', () => {
    expect(render([mark({ radius: 118 })])).toContain('stroke-width="30"');
  });

  it('garde un trait visible au plus petit rayon', () => {
    expect(render([mark({ radius: 4 })])).toContain('stroke-width="2"');
  });

  it('donne à chaque repère son propre trait', () => {
    const svg = render([
      mark({ number: 1, radius: 36 }),
      mark({ number: 2, radius: 118 }),
    ]);

    expect(svg).toContain('stroke-width="9"');
    expect(svg).toContain('stroke-width="30"');
  });

  it('pose le numéro au bord du cercle, hors de l’anneau', () => {
    expect(render([mark({ radius: 36 })])).toContain('<text x="145" y="164"');
  });

  it('rapproche le numéro quand le repère rétrécit', () => {
    expect(render([mark({ radius: 12 })])).toContain('<text x="115" y="188"');
  });

  it('donne au SVG les dimensions natives de la pièce', () => {
    expect(render([mark()])).toContain(
      '<svg width="6768" height="7887" viewBox="0 0 6768 7887"',
    );
  });
});
