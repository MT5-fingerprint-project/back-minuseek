import { actionLabel, describeAction } from './action-labels';

describe('actionLabel', () => {
  it('names a trace calibration in French', () => {
    expect(actionLabel('TRACE_CALIBRATED')).toBe(
      'Résolution de la trace calibrée',
    );
  });

  it('names a reference print calibration in French', () => {
    expect(actionLabel('REFERENCE_PRINT_CALIBRATED')).toBe(
      "Résolution de l'empreinte de référence calibrée",
    );
  });

  it('falls back to the raw code for an unknown type', () => {
    expect(actionLabel('SOMETHING_UNKNOWN')).toBe('SOMETHING_UNKNOWN');
  });
});

describe('describeAction on a calibration', () => {
  it('shows only the new value on a first calibration, the previous being empty', () => {
    expect(
      describeAction('TRACE_CALIBRATED', {
        resolutionDpi: 1207.34,
        previousResolutionDpi: null,
      }),
    ).toBe('resolutionDpi 1207.34');
  });

  it('shows both values on a recalibration', () => {
    expect(
      describeAction('TRACE_CALIBRATED', {
        resolutionDpi: 600,
        previousResolutionDpi: 500,
      }),
    ).toBe('resolutionDpi 600, previousResolutionDpi 500');
  });

  it('names the piece on a reference print calibration', () => {
    expect(
      describeAction('REFERENCE_PRINT_CALIBRATED', {
        referencePrintId: 'ref-1',
        resolutionDpi: 1207.34,
        previousResolutionDpi: null,
      }),
    ).toBe('referencePrintId ref-1, resolutionDpi 1207.34');
  });
});
