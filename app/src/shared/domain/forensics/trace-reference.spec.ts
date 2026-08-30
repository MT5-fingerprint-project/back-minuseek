import { traceReference } from './trace-reference';

describe('traceReference', () => {
  it("compose le numéro d'affaire et le rang de la trace", () => {
    expect(traceReference('3455', 7)).toBe('3455-T7');
  });

  it("ne complète pas le rang par des zéros et ne reformate pas le numéro d'affaire", () => {
    expect(traceReference('2026-00042', 50)).toBe('2026-00042-T50');
  });

  it("n'intercale pas de segment de scène", () => {
    expect(traceReference('2021-01083', 1)).toBe('2021-01083-T1');
  });
});
