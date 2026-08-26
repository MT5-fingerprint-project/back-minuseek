import {
  DetectRulerInput,
  RulerDetection,
  RulerDetectorPort,
} from '../../application/ports/ruler-detector.port';

export class InMemoryRulerDetectorAdapter implements RulerDetectorPort {
  private result: RulerDetection = {
    present: true,
    confidence: 0.9,
    engineVersion: 'ruler-periodicity-1.0+cal.0',
  };
  public lastInput: DetectRulerInput | undefined;

  setResult(result: RulerDetection): void {
    this.result = result;
  }

  detect(input: DetectRulerInput): Promise<RulerDetection> {
    this.lastInput = input;
    return Promise.resolve(this.result);
  }
}
